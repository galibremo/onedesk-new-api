import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { conflictError, notFoundError } from '../../core/errors/domain-error';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { UserWithoutPassword } from '../auth/auth.types';
import { mapTeamManagementResponse, mapTeamMemberResponse } from './team.mapper';
import { TeamPolicy } from './team.policy';
import { TeamRepository } from './team.repository';
import type {
	AddTeamMembersDto,
	CreateTeamDto,
	RemoveTeamMembersDto,
	TeamListQueryDto,
	TeamMemberListQueryDto,
	UpdateMemberRoleDto,
	UpdateTeamDto,
} from './team.schema';
import type {
	AddMembersResponse,
	ArchiveTeamResponse,
	RemoveMembersResponse,
	TeamListResponse,
	TeamManagementResponse,
	TeamMemberListResponse,
	TeamMemberResponse,
} from './team.types';

@Injectable()
export class TeamService {
	constructor(
		private readonly teamRepository: TeamRepository,
		private readonly auditLogService: AuditLogService,
	) {}

	async listTeams(query: TeamListQueryDto): Promise<TeamListResponse> {
		const result = await this.teamRepository.listTeams(query);

		return {
			rows: result.rows.map(mapTeamManagementResponse),
			total: result.total,
			page: result.page,
			pageSize: result.pageSize,
		};
	}

	async getTeamById(publicId: string): Promise<TeamManagementResponse> {
		const team = await this.findActiveTeamByPublicId(publicId);
		const row = await this.teamRepository.findTeamManagementRow(team.id);

		if (!row) throw notFoundError('team_not_found', 'Team not found');

		return mapTeamManagementResponse(row);
	}

	async createTeam(
		data: CreateTeamDto,
		currentUser: UserWithoutPassword,
		request?: Request,
	): Promise<TeamManagementResponse> {
		TeamPolicy.assertCanCreateTeam(currentUser);

		const existing = await this.teamRepository.findTeamByName(data.name, currentUser.id);
		if (existing) {
			throw conflictError('team_name_exists', 'A team with this name already exists.');
		}

		const created = await this.teamRepository.createTeam({
			name: data.name,
			ownerId: currentUser.id,
			status: 'ACTIVE',
		});

		if (!created) throw notFoundError('team_not_found', 'Failed to create team');

		await this.teamRepository.createTeamMembers([
			{
				teamId: created.id,
				userId: currentUser.id,
				role: 'TEAM_LEAD',
				status: 'ACTIVE',
			},
		]);

		if (data.memberIds && data.memberIds.length > 0) {
			const users = await this.teamRepository.findUsersByPublicIds(data.memberIds);

			for (const user of users) {
				TeamPolicy.assertCanAddMember(user);
			}

			await this.teamRepository.createTeamMembers(
				users.map(u => ({
					teamId: created.id,
					userId: u.id,
					role: 'AGENT' as const,
					status: 'ACTIVE' as const,
				})),
			);
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'TEAM_CREATED',
			targetType: 'team',
			targetId: created.publicId,
			metadata: { name: created.name },
			request,
		});

		const row = await this.teamRepository.findTeamManagementRow(created.id);
		if (!row) throw notFoundError('team_not_found', 'Team not found');

		return mapTeamManagementResponse(row);
	}

	async updateTeam(
		publicId: string,
		data: UpdateTeamDto,
		currentUser: UserWithoutPassword,
		request?: Request,
	): Promise<TeamManagementResponse> {
		const team = await this.findActiveTeamByPublicId(publicId);

		TeamPolicy.assertCanManageTeam(currentUser, team.ownerId);

		if (data.name && data.name !== team.name) {
			const existing = await this.teamRepository.findTeamByName(data.name, team.ownerId, team.id);
			if (existing) {
				throw conflictError('team_name_exists', 'A team with this name already exists.');
			}
		}

		const updates: Partial<{ name: string; status: 'ACTIVE' | 'INACTIVE' }> = {};

		if (data.name) {
			updates.name = data.name;
		}

		if (data.status) {
			updates.status = data.status;
		}

		await this.teamRepository.updateTeam(team.id, updates);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'TEAM_UPDATED',
			targetType: 'team',
			targetId: team.publicId,
			metadata: { changes: data },
			request,
		});

		const row = await this.teamRepository.findTeamManagementRow(team.id);
		if (!row) throw notFoundError('team_not_found', 'Team not found');

		return mapTeamManagementResponse(row);
	}

	async archiveTeam(
		publicId: string,
		currentUser: UserWithoutPassword,
		request?: Request,
	): Promise<ArchiveTeamResponse> {
		const team = await this.findActiveTeamByPublicId(publicId);

		TeamPolicy.assertCanManageTeam(currentUser, team.ownerId);

		if (team.deletedAt) {
			throw conflictError('team_already_archived', 'This team is already archived.');
		}

		const archivedName = `${team.id}-archived-${Date.now()}`;
		await this.teamRepository.archiveTeam(team.id, archivedName);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'TEAM_ARCHIVED',
			targetType: 'team',
			targetId: team.publicId,
			metadata: { name: team.name },
			request,
		});

		return { archived: true };
	}

	async listTeamMembers(
		publicId: string,
		query: TeamMemberListQueryDto,
	): Promise<TeamMemberListResponse> {
		const team = await this.findActiveTeamByPublicId(publicId);
		const result = await this.teamRepository.listTeamMembers(team.id, query);

		return {
			rows: result.rows.map(mapTeamMemberResponse),
			total: result.total,
			page: result.page,
			pageSize: result.pageSize,
		};
	}

	async addTeamMembers(
		publicId: string,
		data: AddTeamMembersDto,
		currentUser: UserWithoutPassword,
		request?: Request,
	): Promise<AddMembersResponse> {
		const team = await this.findActiveTeamByPublicId(publicId);

		TeamPolicy.assertCanManageTeam(currentUser, team.ownerId);

		const emails = data.members.map(m => m.email);
		const existingUsers = await this.teamRepository.findUsersByEmails(emails);
		const existingEmailSet = new Set(existingUsers.map(u => u.email));
		const missingEmails = emails.filter(e => !existingEmailSet.has(e));

		for (const user of existingUsers) {
			TeamPolicy.assertCanAddMember(user);
		}

		const existingMembers = await this.teamRepository.findTeamMembersByTeamId(team.id);
		const existingMemberUserIds = new Set(existingMembers.map(m => m.userId));

		const alreadyMemberEmails = existingUsers
			.filter(u => existingMemberUserIds.has(u.id))
			.map(u => u.email);

		if (alreadyMemberEmails.length > 0) {
			throw conflictError(
				'team_member_already_exists',
				`The following members are already part of this team: ${alreadyMemberEmails.join(', ')}`,
			);
		}

		const added = await this.addMembersToTeam(team.id, existingUsers, data.members, missingEmails);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'TEAM_MEMBERS_ADDED',
			targetType: 'team',
			targetId: team.publicId,
			metadata: { added, emails },
			request,
		});

		return { added };
	}

	private async addMembersToTeam(
		teamId: number,
		existingUsers: { id: number; email: string }[],
		memberDataList: AddTeamMembersDto['members'],
		missingEmails: string[],
	): Promise<number> {
		let added = 0;

		if (existingUsers.length > 0) {
			const newMembers = existingUsers.map(u => {
				const memberData = memberDataList.find(m => m.email === u.email)!;
				return {
					teamId,
					userId: u.id,
					role: memberData.role,
					status: 'ACTIVE' as const,
				};
			});

			added += await this.teamRepository.createTeamMembers(newMembers);
		}

		if (missingEmails.length > 0) {
			for (const email of missingEmails) {
				const newUser = await this.teamRepository.createUserByEmail(email);
				if (newUser) {
					const memberData = memberDataList.find(m => m.email === email)!;
					const created = await this.teamRepository.createTeamMembers([
						{
							teamId,
							userId: newUser.id,
							role: memberData.role,
							status: 'INVITED' as const,
						},
					]);
					added += created;
				}
			}
		}

		return added;
	}

	async removeTeamMembers(
		publicId: string,
		data: RemoveTeamMembersDto,
		currentUser: UserWithoutPassword,
		request?: Request,
	): Promise<RemoveMembersResponse> {
		const team = await this.findActiveTeamByPublicId(publicId);

		TeamPolicy.assertCanManageTeam(currentUser, team.ownerId);

		const users = await this.teamRepository.findUsersByPublicIds(data.memberIds);
		const userIds = users.map(u => u.id);

		const removed = await this.teamRepository.removeTeamMembers(team.id, userIds);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'TEAM_MEMBERS_REMOVED',
			targetType: 'team',
			targetId: team.publicId,
			metadata: { removed, memberIds: data.memberIds },
			request,
		});

		return { removed };
	}

	async updateMemberRole(
		teamPublicId: string,
		userPublicId: string,
		data: UpdateMemberRoleDto,
		currentUser: UserWithoutPassword,
		request?: Request,
	): Promise<TeamMemberResponse> {
		const team = await this.findActiveTeamByPublicId(teamPublicId);

		TeamPolicy.assertCanManageTeam(currentUser, team.ownerId);

		const users = await this.teamRepository.findUsersByPublicIds([userPublicId]);
		const targetUser = users[0];

		if (!targetUser) {
			throw notFoundError('user_not_found', 'User not found.');
		}

		TeamPolicy.assertCanAddMember(targetUser);

		await this.teamRepository.updateTeamMemberRole(team.id, targetUser.id, data.role);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'TEAM_MEMBER_ROLE_UPDATED',
			targetType: 'team',
			targetId: team.publicId,
			metadata: { userId: userPublicId, role: data.role },
			request,
		});

		const memberRows = await this.teamRepository.listTeamMembers(team.id, {
			page: 1,
			pageSize: 1,
			search: targetUser.email,
			sort: undefined,
		});

		const member = memberRows.rows[0];
		if (!member) throw notFoundError('member_not_found', 'Team member not found.');

		return mapTeamMemberResponse(member);
	}

	private async findActiveTeamByPublicId(publicId: string) {
		const team = await this.teamRepository.findTeamByPublicId(publicId);

		if (!team || team.deletedAt) {
			throw notFoundError('team_not_found', 'Team not found.');
		}

		return team;
	}
}
