import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Request } from 'express';

import {
	conflictError,
	isDatabaseUniqueViolation,
	notFoundError,
} from '../../core/errors/domain-error';
import type { UserSchemaType } from '../../core/database/types';
import type { UserWithoutPassword } from '../auth/auth.types';
import { ApprovalEmail } from '../auth/emails/approval.email';
import { InvitationEmail } from '../auth/emails/invitation.email';
import { TwoFactorAlertEmail } from '../auth/emails/two-factor-alert.email';
import { TwoFactorService } from '../auth/two-factor/two-factor.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type {
	DeleteUserResponse,
	RevokeUserSessionsResponse,
	ResetUserTwoFactorResponse,
	UserListResponse,
	UserManagementResponse,
} from './users.types';
import { mapUserManagementResponse } from './users.mapper';
import { UsersPolicy } from './users.policy';
import { UsersRepository } from './users.repository';
import type {
	CreateUserDto,
	UpdateUserDto,
	UpdateUserRoleDto,
	UsersListQueryDto,
} from './users.schema';

@Injectable()
export class UsersService {
	constructor(
		private readonly usersRepository: UsersRepository,
		private readonly twoFactorService: TwoFactorService,
		private readonly auditLogService: AuditLogService,
		private readonly invitationEmail: InvitationEmail,
		private readonly approvalEmail: ApprovalEmail,
		private readonly twoFactorAlertEmail: TwoFactorAlertEmail,
	) {}

	async listUsers(query: UsersListQueryDto): Promise<UserListResponse> {
		const users = await this.usersRepository.listUsers(query);

		return {
			rows: users.rows.map(mapUserManagementResponse),
			total: users.total,
			page: users.page,
			pageSize: users.pageSize,
		};
	}

	async getUserById(
		currentUser: UserWithoutPassword,
		publicId: string,
	): Promise<UserManagementResponse> {
		const targetUser = await this.getTargetUser(publicId);

		UsersPolicy.assertCanManageUser(currentUser, targetUser);

		return this.getManagementResponse(targetUser.id);
	}

	async createUser(
		currentUser: UserWithoutPassword,
		data: CreateUserDto,
		request?: Request,
	): Promise<UserManagementResponse> {
		UsersPolicy.assertCanAssignRole(currentUser, data.role);
		await this.assertEmailAvailable(data.email);

		const password = data.password ? await bcrypt.hash(data.password, 10) : null;

		try {
			const createdUser = await this.usersRepository.createUser({
				name: data.name ?? null,
				email: data.email,
				password,
				phone: data.phone ?? null,
				emailVerified: data.emailVerified ?? false,
				role: data.role,
				isApproved: data.isApproved ?? true,
			});

			if (!createdUser) throw notFoundError('user_not_found', 'User not found');

			const user = await this.getManagementResponse(createdUser.id);

			await this.invitationEmail.send({
				email: user.email,
				name: user.name,
				role: user.role,
				createdByName: currentUser.name,
			});
			await this.auditLogService.logAction({
				actor: currentUser,
				action: 'USER_CREATED',
				targetType: 'user',
				targetId: createdUser.publicId,
				metadata: {
					email: createdUser.email,
					role: createdUser.role,
					isApproved: createdUser.isApproved,
					emailVerified: createdUser.emailVerified,
					hasPassword: Boolean(data.password),
				},
				request,
			});

			return user;
		} catch (error) {
			this.throwEmailConflictIfUniqueViolation(error);
			throw error;
		}
	}

	async updateUser(
		currentUser: UserWithoutPassword,
		publicId: string,
		data: UpdateUserDto,
		request?: Request,
	): Promise<UserManagementResponse> {
		const targetUser = await this.getTargetUser(publicId);

		UsersPolicy.assertCanManageUser(currentUser, targetUser);

		if (data.email && data.email !== targetUser.email) {
			await this.assertEmailAvailable(data.email, targetUser.id);
		}

		try {
			await this.usersRepository.updateUser(targetUser.id, {
				...(Object.prototype.hasOwnProperty.call(data, 'name') ? { name: data.name ?? null } : {}),
				...(data.email ? { email: data.email } : {}),
				...(Object.prototype.hasOwnProperty.call(data, 'phone')
					? { phone: data.phone ?? null }
					: {}),
				...(typeof data.emailVerified === 'boolean' ? { emailVerified: data.emailVerified } : {}),
				...(typeof data.isApproved === 'boolean' ? { isApproved: data.isApproved } : {}),
			});

			const user = await this.getManagementResponse(targetUser.id);

			if (!targetUser.isApproved && user.isApproved) {
				await this.approvalEmail.send({
					email: user.email,
					name: user.name,
					approvedByName: currentUser.name,
				});
			}

			await this.auditLogService.logAction({
				actor: currentUser,
				action: 'USER_UPDATED',
				targetType: 'user',
				targetId: targetUser.publicId,
				metadata: {
					changes: this.getUserUpdateChanges(targetUser, data),
				},
				request,
			});

			return user;
		} catch (error) {
			this.throwEmailConflictIfUniqueViolation(error);
			throw error;
		}
	}

	async updateUserRole(
		currentUser: UserWithoutPassword,
		publicId: string,
		data: UpdateUserRoleDto,
		request?: Request,
	): Promise<UserManagementResponse> {
		const targetUser = await this.getTargetUser(publicId);

		UsersPolicy.assertCanManageUser(currentUser, targetUser);
		UsersPolicy.assertCanAssignRole(currentUser, data.role);

		if (targetUser.role !== data.role) {
			await this.usersRepository.updateUserRole(targetUser.id, data.role);
		}

		const user = await this.getManagementResponse(targetUser.id);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'ROLE_UPDATED',
			targetType: 'user',
			targetId: targetUser.publicId,
			metadata: {
				from: targetUser.role,
				to: data.role,
				changed: targetUser.role !== data.role,
			},
			request,
		});

		return user;
	}

	async deleteUser(
		currentUser: UserWithoutPassword,
		publicId: string,
		request?: Request,
	): Promise<DeleteUserResponse> {
		const targetUser = await this.getTargetUser(publicId);

		UsersPolicy.assertCanManageUser(currentUser, targetUser);

		const deletedUser = await this.usersRepository.deleteUser(targetUser.id);
		if (!deletedUser) throw notFoundError('user_not_found', 'User not found');

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'USER_DELETED',
			targetType: 'user',
			targetId: targetUser.publicId,
			metadata: {
				email: targetUser.email,
				role: targetUser.role,
			},
			request,
		});

		return { deleted: true };
	}

	async revokeUserSessions(
		currentUser: UserWithoutPassword,
		publicId: string,
		request?: Request,
	): Promise<RevokeUserSessionsResponse> {
		const targetUser = await this.getTargetUser(publicId);

		UsersPolicy.assertCanManageUser(currentUser, targetUser);

		const revokedCount = await this.usersRepository.revokeAllUserSessions(targetUser.id);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'USER_SESSIONS_REVOKED',
			targetType: 'user',
			targetId: targetUser.publicId,
			metadata: {
				revokedCount,
			},
			request,
		});

		return { revokedCount };
	}

	async resetUserTwoFactor(
		currentUser: UserWithoutPassword,
		publicId: string,
		request?: Request,
	): Promise<ResetUserTwoFactorResponse> {
		const targetUser = await this.getTargetUser(publicId);

		UsersPolicy.assertCanManageUser(currentUser, targetUser);

		const result = await this.twoFactorService.resetUserTwoFactor(targetUser.id);
		const context = this.getRequestContext(request);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: '2FA_RESET',
			targetType: 'user',
			targetId: targetUser.publicId,
			metadata: {
				wasEnabled: targetUser.is2faEnabled,
				revokedCount: result.revokedCount,
			},
			request,
		});
		await this.twoFactorAlertEmail.send({
			email: targetUser.email,
			name: targetUser.name,
			event: 'reset',
			ipAddress: context.ipAddress,
			userAgent: context.userAgent,
		});

		return result;
	}

	private async getTargetUser(publicId: string) {
		const targetUser = await this.usersRepository.findUserByPublicId(publicId);

		if (!targetUser) throw notFoundError('user_not_found', 'User not found');

		return targetUser;
	}

	private async getManagementResponse(userId: number): Promise<UserManagementResponse> {
		const user = await this.usersRepository.findUserManagementRowById(userId);
		if (!user) throw notFoundError('user_not_found', 'User not found');

		return mapUserManagementResponse(user);
	}

	private async assertEmailAvailable(email: string, excludedUserId?: number): Promise<void> {
		const existingUser = await this.usersRepository.findUserByEmail(email);

		if (existingUser && existingUser.id !== excludedUserId) {
			throw conflictError('email_already_exists', 'A user with this email already exists.');
		}
	}

	private throwEmailConflictIfUniqueViolation(error: unknown): void {
		if (isDatabaseUniqueViolation(error)) {
			throw conflictError('email_already_exists', 'A user with this email already exists.');
		}
	}

	private getUserUpdateChanges(
		targetUser: UserSchemaType,
		data: UpdateUserDto,
	): Record<string, { from: unknown; to: unknown }> {
		const changes: Record<string, { from: unknown; to: unknown }> = {};

		this.addChange(changes, 'name', targetUser.name, data.name ?? null, data);
		this.addChange(changes, 'email', targetUser.email, data.email, data);
		this.addChange(changes, 'phone', targetUser.phone, data.phone ?? null, data);
		this.addChange(changes, 'emailVerified', targetUser.emailVerified, data.emailVerified, data);
		this.addChange(changes, 'isApproved', targetUser.isApproved, data.isApproved, data);

		return changes;
	}

	private addChange(
		changes: Record<string, { from: unknown; to: unknown }>,
		key: keyof UpdateUserDto,
		from: unknown,
		to: unknown,
		data: UpdateUserDto,
	): void {
		if (!Object.prototype.hasOwnProperty.call(data, key)) return;
		if (from === to) return;

		changes[key] = { from, to };
	}

	private getRequestContext(request?: Request): {
		ipAddress: string | null;
		userAgent: string | null;
	} {
		if (!request) {
			return {
				ipAddress: null,
				userAgent: null,
			};
		}

		const forwardedFor = this.getKnownValue(request.get('x-forwarded-for'));
		const forwardedIp = forwardedFor?.split(',')[0]?.trim();
		const ipAddress =
			this.getKnownValue(forwardedIp) ??
			this.getKnownValue(request.get('x-real-ip')) ??
			this.getKnownValue(request.ip) ??
			this.getKnownValue(request.socket.remoteAddress);
		const userAgent =
			this.getKnownValue(request.get('x-client-user-agent')) ??
			this.getKnownValue(request.get('x-original-user-agent')) ??
			this.getKnownValue(request.get('x-forwarded-user-agent')) ??
			this.getKnownValue(request.get('user-agent'));

		return {
			ipAddress: ipAddress ?? null,
			userAgent: userAgent ?? null,
		};
	}

	private getKnownValue(value: string | undefined): string | undefined {
		const trimmed = value?.trim();
		if (!trimmed) return undefined;

		const normalized = trimmed.toLowerCase();
		if (normalized === 'undefined' || normalized === 'null' || normalized === 'unknown') {
			return undefined;
		}

		return trimmed;
	}
}
