import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { badGatewayError, notFoundError } from '../../core/errors/domain-error';
import { ApiResponse, createApiResponse } from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailDispatcherService } from '../smtp/services/email-dispatcher.service';
import { SmtpProvidersRepository } from '../smtp/smtp-providers.repository';
import type { EmailLogListResponse, EmailLogResponse } from './email-log.types';
import {
	type EmailLogsListQueryDto,
	emailLogsListQuerySchema,
} from './email-logs.schema';
import { EmailLogsService } from './email-logs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('email-logs')
export class EmailLogsController {
	constructor(
		private readonly emailLogsService: EmailLogsService,
		private readonly emailDispatcher: EmailDispatcherService,
		private readonly smtpProvidersRepository: SmtpProvidersRepository,
	) {}

	@Get()
	async listEmailLogs(
		@Query(new ZodValidationPipe(emailLogsListQuerySchema)) query: EmailLogsListQueryDto,
	): Promise<ApiResponse<EmailLogListResponse>> {
		let providerId: number | undefined;
		if (query.providerId) {
			const provider = await this.smtpProvidersRepository.findByPublicId(query.providerId);
			if (!provider) {
				throw notFoundError('smtp_provider_not_found', 'SMTP provider not found');
			}
			providerId = provider.id;
		}

		const result = await this.emailLogsService.listAllLogs(providerId, query);
		return createApiResponse(HttpStatus.OK, 'Email logs fetched successfully', result);
	}

	@Get(':logId')
	async getEmailLog(
		@Param('logId') logId: string,
	): Promise<ApiResponse<EmailLogResponse>> {
		const log = await this.emailLogsService.getLogByPublicId(logId);
		return createApiResponse(HttpStatus.OK, 'Email log fetched successfully', log);
	}

	@Post(':logId/resend')
	@HttpCode(HttpStatus.OK)
	async resendEmailLog(
		@Param('logId') logId: string,
	): Promise<ApiResponse<EmailLogResponse>> {
		const logData = await this.emailLogsService.getLogForResend(logId);

		try {
			await this.emailDispatcher.sendFromTemplate({
				templateKey: logData.templateKey,
				to: [{ email: logData.toEmail, name: logData.toName ?? undefined }],
				params: {},
			});
		} catch {
			throw badGatewayError('email_resend_failed', 'Failed to resend email');
		}

		const latestLog = await this.emailLogsService.getLatestLogForProvider(
			logData.smtpProviderId ?? 0,
		);

		return createApiResponse(
			HttpStatus.OK,
			'Email resent successfully',
			latestLog ?? (await this.emailLogsService.getLogByPublicId(logId)),
		);
	}

	@Delete(':logId')
	async deleteEmailLog(
		@Param('logId') logId: string,
	): Promise<ApiResponse<{ deleted: boolean }>> {
		const result = await this.emailLogsService.deleteLogByPublicId(logId);
		return createApiResponse(HttpStatus.OK, 'Email log deleted successfully', result);
	}
}
