import { Injectable, Logger } from '@nestjs/common';

import { badGatewayError, notFoundError } from '../../core/errors/domain-error';
import type { EmailLogSchemaType } from '../../core/database/types';
import type { EmailLogListResponse, EmailLogResponse } from './email-log.types';
import { EmailLogsRepository } from './email-logs.repository';
import type { EmailLogsListQueryDto } from './email-logs.schema';

export interface CreateEmailLogParams {
	smtpProviderId: number | null;
	toEmail: string;
	toName?: string;
	subject: string;
	templateKey?: string;
	status: 'sent' | 'failed';
	errorMessage?: string;
	metadata?: Record<string, unknown>;
}

@Injectable()
export class EmailLogsService {
	private readonly logger = new Logger(EmailLogsService.name);

	constructor(private readonly repository: EmailLogsRepository) {}

	async createLog(params: CreateEmailLogParams): Promise<void> {
		try {
			await this.repository.create({
				smtpProviderId: params.smtpProviderId,
				toEmail: params.toEmail,
				toName: params.toName,
				subject: params.subject,
				templateKey: params.templateKey,
				status: params.status,
				errorMessage: params.errorMessage,
				metadata: params.metadata ?? {},
			});
		} catch (error) {
			this.logger.warn(`Failed to write email log: ${this.getErrorMessage(error)}`);
		}
	}

	async listAllLogs(
		providerId: number | undefined,
		query: EmailLogsListQueryDto,
	): Promise<EmailLogListResponse> {
		const result =
			providerId !== undefined
				? await this.repository.findByProviderId(providerId, query)
				: await this.repository.findAll(query);

		return {
			rows: result.rows.map(row => this.toResponse(row)),
			total: result.total,
			page: result.page,
			pageSize: result.pageSize,
		};
	}

	async getLogByPublicId(logPublicId: string): Promise<EmailLogResponse> {
		const log = await this.repository.findByPublicId(logPublicId);
		if (!log) {
			throw notFoundError('email_log_not_found', 'Email log not found');
		}

		return this.toResponse(log);
	}

	async getLogForResend(logPublicId: string): Promise<{
		templateKey: string;
		toEmail: string;
		toName: string | null;
		smtpProviderId: number | null;
	}> {
		const log = await this.repository.findByPublicId(logPublicId);
		if (!log) {
			throw notFoundError('email_log_not_found', 'Email log not found');
		}

		if (!log.templateKey) {
			throw badGatewayError(
				'cannot_resend_raw_email',
				'Cannot resend: no template associated with this email',
			);
		}

		return {
			templateKey: log.templateKey,
			toEmail: log.toEmail,
			toName: log.toName,
			smtpProviderId: log.smtpProviderId,
		};
	}

	async getLatestLogForProvider(providerId: number): Promise<EmailLogResponse | null> {
		const result = await this.repository.findByProviderId(providerId, {
			page: 1,
			pageSize: 1,
			sort: 'createdAt',
			dir: 'desc',
		});

		if (result.rows.length === 0) return null;
		return this.toResponse(result.rows[0]);
	}

	async deleteLogByPublicId(logPublicId: string): Promise<{ deleted: boolean }> {
		const log = await this.repository.findByPublicId(logPublicId);
		if (!log) {
			throw notFoundError('email_log_not_found', 'Email log not found');
		}

		const deleted = await this.repository.deleteByPublicIdAndProviderId(
			logPublicId,
			log.smtpProviderId ?? 0,
		);
		if (!deleted) {
			throw notFoundError('email_log_not_found', 'Email log not found');
		}

		return { deleted: true };
	}

	private toResponse(log: EmailLogSchemaType): EmailLogResponse {
		return {
			id: log.publicId,
			smtpProviderId: log.smtpProviderId ? String(log.smtpProviderId) : null,
			toEmail: log.toEmail,
			toName: log.toName,
			subject: log.subject,
			templateKey: log.templateKey,
			status: log.status as 'sent' | 'failed',
			errorMessage: log.errorMessage,
			metadata: log.metadata,
			createdAt: log.createdAt.toISOString(),
			updatedAt: log.updatedAt.toISOString(),
		};
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Unknown error';
	}
}
