import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvType } from '../../../core/validators/env';
import { EmailDispatcherService } from '../../smtp/services/email-dispatcher.service';

interface SendApprovalEmailParams {
	email: string;
	name?: string | null;
	approvedByName?: string | null;
}

@Injectable()
export class ApprovalEmail {
	private readonly logger = new Logger(ApprovalEmail.name);

	constructor(
		private readonly emailDispatcher: EmailDispatcherService,
		private readonly configService: ConfigService<EnvType, true>,
	) {}

	async send(params: SendApprovalEmailParams): Promise<void> {
		const name = params.name ?? 'there';
		const approvedByName = params.approvedByName ?? 'an administrator';
		const appUrl = this.configService.get('APP_URL', { infer: true });
		const year = new Date().getFullYear();

		const htmlContent = `
			<!DOCTYPE html>
			<html>
			<head><meta charset="utf-8"></head>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
				<h2>Account Approved</h2>
				<p>Hi ${name},</p>
				<p>Your account has been approved by ${approvedByName}.</p>
				<p>You can now access the platform:</p>
				<p><a href="${appUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 4px;">Go to Dashboard</a></p>
				<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
				<p style="font-size: 12px; color: #666;">&copy; ${year} All rights reserved.</p>
			</body>
			</html>
		`;

		const textContent = `Account Approved\n\nHi ${name},\n\nYour account has been approved by ${approvedByName}.\n\nYou can now access the platform at: ${appUrl}`;

		try {
			await this.emailDispatcher.sendEmail({
				to: [{ email: params.email, name: params.name ?? undefined }],
				subject: 'Your account has been approved',
				htmlContent,
				textContent,
			});
		} catch (error) {
			this.logger.warn(`Failed to send approval email: ${this.getErrorMessage(error)}`);
		}
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Unknown error';
	}
}
