import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvType } from '../../../core/validators/env';
import type { RoleTypeEnum } from '../../../core/database/types';
import { EmailDispatcherService } from '../../smtp/services/email-dispatcher.service';

interface SendInvitationEmailParams {
	email: string;
	name?: string | null;
	role: RoleTypeEnum;
	createdByName?: string | null;
}

@Injectable()
export class InvitationEmail {
	private readonly logger = new Logger(InvitationEmail.name);

	constructor(
		private readonly emailDispatcher: EmailDispatcherService,
		private readonly configService: ConfigService<EnvType, true>,
	) {}

	async send(params: SendInvitationEmailParams): Promise<void> {
		const name = params.name ?? 'there';
		const createdByName = params.createdByName ?? 'an administrator';
		const appUrl = this.configService.get('APP_URL', { infer: true });
		const year = new Date().getFullYear();

		const htmlContent = `
			<!DOCTYPE html>
			<html>
			<head><meta charset="utf-8"></head>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
				<h2>You've been invited</h2>
				<p>Hi ${name},</p>
				<p>${createdByName} has invited you to join the platform with the role of <strong>${params.role}</strong>.</p>
				<p>Click the link below to set up your account:</p>
				<p><a href="${appUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 4px;">Accept Invitation</a></p>
				<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
				<p style="font-size: 12px; color: #666;">&copy; ${year} All rights reserved.</p>
			</body>
			</html>
		`;

		const textContent = `You've been invited\n\nHi ${name},\n\n${createdByName} has invited you to join the platform with the role of ${params.role}.\n\nVisit ${appUrl} to set up your account.`;

		try {
			await this.emailDispatcher.sendEmail({
				to: [{ email: params.email, name: params.name ?? undefined }],
				subject: `You've been invited to join as ${params.role}`,
				htmlContent,
				textContent,
			});
		} catch (error) {
			this.logger.warn(`Failed to send invitation email: ${this.getErrorMessage(error)}`);
		}
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Unknown error';
	}
}
