import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrgId } from '../../common/decorators/current-org-id.decorator';
import { ApiResponse, createApiResponse } from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UserWithoutPassword } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoles, OrgRolesGuard } from './guards/org-roles.guard';
import { OrganizationService } from './organization.service';
import type {
	OrganizationDetails,
	OrganizationListItem,
	OrganizationMemberItem,
	UploadLogoResponse,
} from './organization.types';
import {
	addMembersSchema,
	createOrganizationSchema,
	membersListQuerySchema,
	removeMembersSchema,
	updateMemberRoleSchema,
	updateOrganizationSchema,
	type AddMembersDto,
	type CreateOrganizationDto,
	type MembersListQueryDto,
	type RemoveMembersDto,
	type UpdateMemberRoleDto,
	type UpdateOrganizationDto,
} from './organization.schema';

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
	constructor(private readonly organizationService: OrganizationService) {}

	@Get('list')
	async list(
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<OrganizationListItem[]>> {
		const orgs = await this.organizationService.getList(currentUser);
		return createApiResponse(HttpStatus.OK, 'Organizations fetched successfully', orgs);
	}

	@Post('create')
	async create(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationDto,
	): Promise<ApiResponse<OrganizationDetails>> {
		const org = await this.organizationService.create(body, currentUser);
		return createApiResponse(HttpStatus.CREATED, 'Organization created successfully', org);
	}

	@Get('members')
	@UseGuards(OrgRolesGuard)
	@OrgRoles('ADMIN', 'SUPERVISOR')
	async getMembers(
		@CurrentOrgId() orgId: string,
	): Promise<ApiResponse<OrganizationMemberItem[]>> {
		const members = await this.organizationService.getMembers(orgId);
		return createApiResponse(HttpStatus.OK, 'Members fetched successfully', members);
	}

	@Get('members/list')
	@UseGuards(OrgRolesGuard)
	@OrgRoles('ADMIN', 'SUPERVISOR')
	async getMembersList(
		@CurrentOrgId() orgId: string,
		@Query(new ZodValidationPipe(membersListQuerySchema)) query: MembersListQueryDto,
	): Promise<ApiResponse<{ members: OrganizationMemberItem[]; total: number; page: number; limit: number }>> {
		const result = await this.organizationService.getMembersList(orgId, query);
		return createApiResponse(HttpStatus.OK, 'Members list fetched successfully', result);
	}

	@Post('members/add')
	@HttpCode(HttpStatus.OK)
	@UseGuards(OrgRolesGuard)
	@OrgRoles('ADMIN', 'SUPERVISOR')
	// TODO: add SubscriptionGuard + UserLimitGuard once subscription module is migrated
	async addMembers(
		@CurrentUser() currentUser: UserWithoutPassword,
		@CurrentOrgId() orgId: string,
		@Body(new ZodValidationPipe(addMembersSchema)) body: AddMembersDto,
	): Promise<ApiResponse<{ added: number }>> {
		const result = await this.organizationService.addMembers(orgId, currentUser, body);
		return createApiResponse(HttpStatus.OK, 'Members added successfully', result);
	}

	@Put('members/update-role')
	@UseGuards(OrgRolesGuard)
	@OrgRoles('ADMIN', 'SUPERVISOR')
	// TODO: add SubscriptionGuard once subscription module is migrated
	async updateMemberRole(
		@CurrentUser() currentUser: UserWithoutPassword,
		@CurrentOrgId() orgId: string,
		@Body(new ZodValidationPipe(updateMemberRoleSchema)) body: UpdateMemberRoleDto,
	): Promise<ApiResponse<void>> {
		await this.organizationService.updateMemberRole(orgId, currentUser, body);
		return createApiResponse(HttpStatus.OK, 'Member role updated successfully');
	}

	@Delete('members/remove')
	@UseGuards(OrgRolesGuard)
	@OrgRoles('ADMIN', 'SUPERVISOR')
	// TODO: add SubscriptionGuard once subscription module is migrated
	async removeMembers(
		@CurrentUser() currentUser: UserWithoutPassword,
		@CurrentOrgId() orgId: string,
		@Body(new ZodValidationPipe(removeMembersSchema)) body: RemoveMembersDto,
	): Promise<ApiResponse<void>> {
		await this.organizationService.removeMembers(orgId, currentUser, body);
		return createApiResponse(HttpStatus.OK, 'Members removed successfully');
	}

	@Put('upload-logo')
	@UseGuards(OrgRolesGuard)
	@OrgRoles('ADMIN')
	// TODO: add SubscriptionGuard once subscription module is migrated
	@UseInterceptors(FileInterceptor('file'))
	async uploadLogo(
		@CurrentUser() currentUser: UserWithoutPassword,
		@CurrentOrgId() orgId: string,
		@UploadedFile() file: Express.Multer.File,
	): Promise<ApiResponse<UploadLogoResponse>> {
		if (!file) {
			throw new (require('@nestjs/common').BadRequestException)('A file is required.');
		}
		const result = await this.organizationService.uploadLogo(orgId, currentUser, file);
		return createApiResponse(HttpStatus.OK, 'Logo uploaded successfully', result);
	}

	@Put('update')
	@UseGuards(OrgRolesGuard)
	@OrgRoles('ADMIN')
	// TODO: add SubscriptionGuard once subscription module is migrated
	async update(
		@CurrentUser() currentUser: UserWithoutPassword,
		@CurrentOrgId() orgId: string,
		@Body(new ZodValidationPipe(updateOrganizationSchema)) body: UpdateOrganizationDto,
	): Promise<ApiResponse<OrganizationDetails>> {
		const org = await this.organizationService.update(orgId, currentUser, body);
		return createApiResponse(HttpStatus.OK, 'Organization updated successfully', org);
	}

	@Get(':id')
	async getOne(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<ApiResponse<OrganizationDetails>> {
		const org = await this.organizationService.getOne(id, currentUser);
		return createApiResponse(HttpStatus.OK, 'Organization fetched successfully', org);
	}
}
