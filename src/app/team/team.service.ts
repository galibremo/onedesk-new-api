import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { conflictError, notFoundError } from '../../core/errors/domain-error';
import type { UserWithoutPassword } from '../auth/auth.types';
import { AuditLogService } from '../audit-log/audit-log.service';
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
	SelectTeamResponse,
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

	async getTeamById(
		publicId: string,
		currentUser: UserWithoutPassword,
	): Promise<TeamManagementResponse> {
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

		const slug = await this.slugGenerator(data.name);

		const created = await this.teamRepository.createTeam({
			name: data.name,
			slug,
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
			metadata: { name: created.name, slug: created.slug },
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
			const existing = await this.teamRepository.findTeamByName(
				data.name,
				team.ownerId,
				team.id,
			);
			if (existing) {
				throw conflictError('team_name_exists', 'A team with this name already exists.');
			}
		}

		const updates: Partial<{ name: string; slug: string; status: 'ACTIVE' | 'INACTIVE' }> = {};

		if (data.name) {
			updates.name = data.name;
			if (data.name !== team.name) {
				updates.slug = await this.slugGenerator(data.name);
			}
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
		currentUser: UserWithoutPassword,
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

		const userPublicIds = data.members.map(m => m.userId);
		const users = await this.teamRepository.findUsersByPublicIds(userPublicIds);

		if (users.length !== userPublicIds.length) {
			throw notFoundError('user_not_found', 'One or more users were not found.');
		}

		for (const user of users) {
			TeamPolicy.assertCanAddMember(user);
		}

		const existingMembers = await this.teamRepository.findTeamMembersByTeamId(team.id);
		const existingUserIds = new Set(existingMembers.map(m => m.userId));

		const newMembers = users
			.filter(u => !existingUserIds.has(u.id))
			.map(u => {
				const memberData = data.members.find(m => m.userId === u.publicId)!;
				return {
					teamId: team.id,
					userId: u.id,
					role: memberData.role,
					status: 'ACTIVE' as const,
				};
			});

		if (newMembers.length === 0) {
			throw conflictError('members_already_exist', 'All provided users are already team members.');
		}

		const added = await this.teamRepository.createTeamMembers(newMembers);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'TEAM_MEMBERS_ADDED',
			targetType: 'team',
			targetId: team.publicId,
			metadata: { added, memberIds: userPublicIds },
			request,
		});

		return { added };
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

	async selectTeam(
		publicId: string,
		currentUser: UserWithoutPassword,
		request?: Request,
	): Promise<SelectTeamResponse> {
		const team = await this.findActiveTeamByPublicId(publicId);

		const member = await this.teamRepository.findTeamMember(team.id, currentUser.id);

		if (!member) {
			throw notFoundError('not_a_team_member', 'You are not a member of this team.');
		}

		await this.teamRepository.updateUserCurrentTeam(currentUser.id, team.id, member.role);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'TEAM_SELECTED',
			targetType: 'team',
			targetId: team.publicId,
			metadata: { teamName: team.name },
			request,
		});

		return {
			currentTeamId: team.publicId,
			currentTeamRole: member.role,
		};
	}

	private async findActiveTeamByPublicId(publicId: string) {
		const team = await this.teamRepository.findTeamByPublicId(publicId);

		if (!team || team.deletedAt) {
			throw notFoundError('team_not_found', 'Team not found.');
		}

		return team;
	}

	private async slugGenerator(name: string): Promise<string> {
		const base =
			name
				.toLowerCase()
				.trim()
				.replace(/[^\w\s-]/g, '')
				.replace(/[\s_]+/g, '-')
				.replace(/^-+|-+$/g, '') || 'team';

		let slug = base;
		let counter = 1;

		while (await this.teamRepository.slugExists(slug)) {
			slug = `${base}-${counter++}`;
		}

		return slug;
	}
}
