import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	Request,
	UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse, createApiResponse } from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UserWithoutPassword } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type {
	SmtpProviderListResponse,
	SmtpProviderResponse,
	TestConnectionResponse,
} from './smtp.types';
import {
	type CreateSmtpProviderDto,
	createSmtpProviderSchema,
	type SmtpProvidersListQueryDto,
	smtpProvidersListQuerySchema,
	type UpdateSmtpProviderDto,
	updateSmtpProviderSchema,
} from './smtp-providers.schema';
import { SmtpProvidersService } from './services/smtp-providers.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('smtp-providers')
export class SmtpProvidersController {
	constructor(private readonly smtpProvidersService: SmtpProvidersService) {}

	@Get()
	async listProviders(
		@Query(new ZodValidationPipe(smtpProvidersListQuerySchema)) query: SmtpProvidersListQueryDto,
	): Promise<ApiResponse<SmtpProviderListResponse>> {
		const result = await this.smtpProvidersService.listProviders(query);
		return createApiResponse(HttpStatus.OK, 'SMTP providers fetched successfully', result);
	}

	@Get(':id')
	async getProvider(@Param('id') id: string): Promise<ApiResponse<SmtpProviderResponse>> {
		const provider = await this.smtpProvidersService.getProvider(id);
		return createApiResponse(HttpStatus.OK, 'SMTP provider fetched successfully', provider);
	}

	@Post()
	async createProvider(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(createSmtpProviderSchema)) body: CreateSmtpProviderDto,
	): Promise<ApiResponse<SmtpProviderResponse>> {
		const provider = await this.smtpProvidersService.createProvider(currentUser, body, request);
		return createApiResponse(HttpStatus.CREATED, 'SMTP provider created successfully', provider);
	}

	@Patch(':id')
	async updateProvider(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Param('id') id: string,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(updateSmtpProviderSchema)) body: UpdateSmtpProviderDto,
	): Promise<ApiResponse<SmtpProviderResponse>> {
		const provider = await this.smtpProvidersService.updateProvider(currentUser, id, body, request);
		return createApiResponse(HttpStatus.OK, 'SMTP provider updated successfully', provider);
	}

	@Delete(':id')
	async deleteProvider(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Param('id') id: string,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<{ deleted: boolean }>> {
		const result = await this.smtpProvidersService.deleteProvider(currentUser, id, request);
		return createApiResponse(HttpStatus.OK, 'SMTP provider deleted successfully', result);
	}

	@Post(':id/test')
	@HttpCode(HttpStatus.OK)
	async testConnection(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Param('id') id: string,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<TestConnectionResponse>> {
		const result = await this.smtpProvidersService.testConnection(currentUser, id, request);
		return createApiResponse(
			HttpStatus.OK,
			result.success ? 'Connection test successful' : 'Connection test failed',
			result,
		);
	}

	@Post(':id/set-default')
	@HttpCode(HttpStatus.OK)
	async setDefault(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Param('id') id: string,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<SmtpProviderResponse>> {
		const provider = await this.smtpProvidersService.setDefault(currentUser, id, request);
		return createApiResponse(HttpStatus.OK, 'Default SMTP provider set successfully', provider);
	}

	@Patch(':id/toggle')
	async toggleProvider(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Param('id') id: string,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<SmtpProviderResponse>> {
		const provider = await this.smtpProvidersService.toggleProvider(currentUser, id, request);
		return createApiResponse(HttpStatus.OK, 'SMTP provider toggled successfully', provider);
	}
}
