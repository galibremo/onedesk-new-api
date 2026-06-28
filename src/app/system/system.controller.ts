import { Body, Controller, Get, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse, createApiResponse } from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemService } from './system.service';
import { type UpdateSystemSettingsDto, updateSystemSettingsSchema } from './system.schema';
import type { SystemSettingsSchemaType } from '../../core/database/types';

@Controller('system')
export class SystemController {
	constructor(private readonly systemService: SystemService) {}

	@Get('settings/public')
	async getPublicSettings(): Promise<ApiResponse<{ accessModel: string; allowedRoles: string[] }>> {
		const settings = await this.systemService.getSettings();
		return createApiResponse(HttpStatus.OK, 'Public settings fetched successfully', {
			accessModel: settings.accessModel,
			allowedRoles: settings.allowedRoles,
		});
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN')
	@Get('settings')
	async getSettings(): Promise<ApiResponse<SystemSettingsSchemaType>> {
		const settings = await this.systemService.getSettings();
		return createApiResponse(HttpStatus.OK, 'Settings fetched successfully', settings);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN')
	@Patch('settings')
	async updateSettings(
		@Body(new ZodValidationPipe(updateSystemSettingsSchema)) body: UpdateSystemSettingsDto,
	): Promise<ApiResponse<SystemSettingsSchemaType>> {
		const settings = await this.systemService.updateSettings(body);
		return createApiResponse(HttpStatus.OK, 'Settings updated successfully', settings);
	}
}
