import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse, createApiResponse } from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type {
	EmailTemplateListResponse,
	EmailTemplateResponse,
} from './email-template.types';
import {
	type EmailTemplateListQueryDto,
	emailTemplateListQuerySchema,
} from './schemas/email-template-list.schema';
import { type UpdateEmailTemplateDto, updateEmailTemplateSchema } from './schemas/email-template.schema';
import { EmailTemplateService } from './email-template.service';

function toResponse(
	template: import('../../core/database/types').EmailTemplateSchemaType,
): EmailTemplateResponse {
	return {
		publicId: template.publicId,
		key: template.key,
		subject: template.subject,
		html: template.html,
		text: template.text,
		variables: template.variables,
		version: template.version,
		isActive: template.isActive,
		createdAt: template.createdAt.toISOString(),
		updatedAt: template.updatedAt.toISOString(),
	};
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('email-templates')
export class EmailTemplatesController {
	constructor(private readonly emailTemplateService: EmailTemplateService) {}

	@Get()
	async listTemplates(
		@Query(new ZodValidationPipe(emailTemplateListQuerySchema)) query: EmailTemplateListQueryDto,
	): Promise<ApiResponse<EmailTemplateListResponse>> {
		const result = await this.emailTemplateService.getActiveTemplates(query);
		return createApiResponse(200, 'Email templates fetched successfully', {
			rows: result.rows.map(toResponse),
			total: result.total,
			page: result.page,
			pageSize: result.pageSize,
		});
	}

	@Get(':publicId')
	async getTemplate(
		@Param('publicId') publicId: string,
	): Promise<ApiResponse<EmailTemplateResponse>> {
		const template = await this.emailTemplateService.getByPublicId(publicId);
		return createApiResponse(200, 'Email template fetched successfully', toResponse(template));
	}

	@Patch(':publicId')
	async updateTemplate(
		@Param('publicId') publicId: string,
		@Body(new ZodValidationPipe(updateEmailTemplateSchema)) body: UpdateEmailTemplateDto,
	): Promise<ApiResponse<EmailTemplateResponse>> {
		const template = await this.emailTemplateService.updateTemplate(publicId, body);
		return createApiResponse(200, 'Email template updated successfully', toResponse(template));
	}
}
