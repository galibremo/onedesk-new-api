import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Request,
	UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse, createApiResponse } from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UserWithoutPassword } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
	type AddTeamMembersDto,
	addTeamMembersSchema,
	type CreateTeamDto,
	createTeamSchema,
	type RemoveTeamMembersDto,
	removeTeamMembersSchema,
	type TeamListQueryDto,
	teamListQuerySchema,
	type TeamMemberListQueryDto,
	teamMemberListQuerySchema,
	type UpdateMemberRoleDto,
	updateMemberRoleSchema,
	type UpdateTeamDto,
	updateTeamSchema,
} from './team.schema';
import { TeamService } from './team.service';
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

@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamController {
	constructor(private readonly teamService: TeamService) {}

	@Get()
	async listTeams(
		@Query(new ZodValidationPipe(teamListQuerySchema)) query: TeamListQueryDto,
	): Promise<ApiResponse<TeamListResponse>> {
		const result = await this.teamService.listTeams(query);

		return createApiResponse(HttpStatus.OK, 'Teams fetched successfully', result);
	}

	@Get(':id')
	async getTeam(
		@Param('id', ParseUUIDPipe) id: string,
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<TeamManagementResponse>> {
		const team = await this.teamService.getTeamById(id, currentUser);

		return createApiResponse(HttpStatus.OK, 'Team fetched successfully', team);
	}

	@Post()
	async createTeam(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(createTeamSchema)) body: CreateTeamDto,
	): Promise<ApiResponse<TeamManagementResponse>> {
		const team = await this.teamService.createTeam(body, currentUser, request);

		return createApiResponse(HttpStatus.CREATED, 'Team created successfully', team);
	}

	@Patch(':id')
	async updateTeam(
		@Param('id', ParseUUIDPipe) id: string,
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(updateTeamSchema)) body: UpdateTeamDto,
	): Promise<ApiResponse<TeamManagementResponse>> {
		const team = await this.teamService.updateTeam(id, body, currentUser, request);

		return createApiResponse(HttpStatus.OK, 'Team updated successfully', team);
	}

	@Delete(':id')
	async archiveTeam(
		@Param('id', ParseUUIDPipe) id: string,
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<ArchiveTeamResponse>> {
		const result = await this.teamService.archiveTeam(id, currentUser, request);

		return createApiResponse(HttpStatus.OK, 'Team archived successfully', result);
	}

	@Post(':id/select')
	async selectTeam(
		@Param('id', ParseUUIDPipe) id: string,
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<SelectTeamResponse>> {
		const result = await this.teamService.selectTeam(id, currentUser, request);

		return createApiResponse(HttpStatus.OK, 'Team selected successfully', result);
	}

	@Get(':id/members')
	async listTeamMembers(
		@Param('id', ParseUUIDPipe) id: string,
		@Query(new ZodValidationPipe(teamMemberListQuerySchema)) query: TeamMemberListQueryDto,
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<TeamMemberListResponse>> {
		const result = await this.teamService.listTeamMembers(id, query, currentUser);

		return createApiResponse(HttpStatus.OK, 'Team members fetched successfully', result);
	}

	@Post(':id/members')
	async addTeamMembers(
		@Param('id', ParseUUIDPipe) id: string,
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(addTeamMembersSchema)) body: AddTeamMembersDto,
	): Promise<ApiResponse<AddMembersResponse>> {
		const result = await this.teamService.addTeamMembers(id, body, currentUser, request);

		return createApiResponse(HttpStatus.OK, 'Members added successfully', result);
	}

	@Delete(':id/members')
	async removeTeamMembers(
		@Param('id', ParseUUIDPipe) id: string,
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(removeTeamMembersSchema)) body: RemoveTeamMembersDto,
	): Promise<ApiResponse<RemoveMembersResponse>> {
		const result = await this.teamService.removeTeamMembers(id, body, currentUser, request);

		return createApiResponse(HttpStatus.OK, 'Members removed successfully', result);
	}

	@Patch(':id/members/:userId/role')
	async updateMemberRole(
		@Param('id', ParseUUIDPipe) id: string,
		@Param('userId', ParseUUIDPipe) userId: string,
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(updateMemberRoleSchema)) body: UpdateMemberRoleDto,
	): Promise<ApiResponse<TeamMemberResponse>> {
		const result = await this.teamService.updateMemberRole(id, userId, body, currentUser, request);

		return createApiResponse(HttpStatus.OK, 'Member role updated successfully', result);
	}
}
