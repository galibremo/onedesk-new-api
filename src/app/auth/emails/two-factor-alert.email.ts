import { Injectable, Logger } from '@nestjs/common';

import { EmailDispatcherService } from '../../smtp/services/email-dispatcher.service';

export type TwoFactorAlertEvent = 'enabled' | 'disabled' | 'reset';

interface SendTwoFactorAlertEmailParams {
	email: string;
	name?: string | null;
	event: TwoFactorAlertEvent;
	ipAddress?: string | null;
	userAgent?: string | null;
}

const eventLabels: Record<TwoFactorAlertEvent, string> = {
	enabled: 'enabled',
	disabled: 'disabled',
	reset: 'reset by an administrator',
};

@Injectable()
export class TwoFactorAlertEmail {
	private readonly logger = new Logger(TwoFactorAlertEmail.name);

	constructor(private readonly emailDispatcher: EmailDispatcherService) {}

	async send(params: SendTwoFactorAlertEmailParams): Promise<void> {
		const name = params.name ?? 'there';
		const eventLabel = eventLabels[params.event];
		const ipAddress = params.ipAddress ?? 'Unknown';
		const userAgent = params.userAgent ?? 'Unknown';
		const year = new Date().getFullYear();

		const htmlContent = `
			<!DOCTYPE html>
			<html>
			<head><meta charset="utf-8"></head>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
				<h2>Two-Factor Authentication ${eventLabel.charAt(0).toUpperCase() + eventLabel.slice(1)}</h2>
				<p>Hi ${name},</p>
				<p>Your two-factor authentication has been <strong>${eventLabel}</strong>.</p>
				<p><strong>Details:</strong></p>
				<ul>
					<li>IP Address: ${ipAddress}</li>
					<li>User Agent: ${userAgent}</li>
				</ul>
				<p>If you did not make this change, please contact support immediately.</p>
				<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
				<p style="font-size: 12px; color: #666;">&copy; ${year} All rights reserved.</p>
			</body>
			</html>
		`;

		const textContent = `Two-Factor Authentication ${eventLabel}\n\nHi ${name},\n\nYour two-factor authentication has been ${eventLabel}.\n\nDetails:\n- IP Address: ${ipAddress}\n- User Agent: ${userAgent}\n\nIf you did not make this change, please contact support immediately.`;

		try {
			await this.emailDispatcher.sendEmail({
				to: [{ email: params.email, name: params.name ?? undefined }],
				subject: `Two-factor authentication ${eventLabel}`,
				htmlContent,
				textContent,
			});
		} catch (error) {
			this.logger.warn(`Failed to send two-factor alert email: ${this.getErrorMessage(error)}`);
		}
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Unknown error';
	}
}
