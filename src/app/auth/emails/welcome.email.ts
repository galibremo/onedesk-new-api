import { Injectable, Logger } from '@nestjs/common';

import { EmailDispatcherService } from '../../smtp/services/email-dispatcher.service';

interface SendWelcomeEmailParams {
	email: string;
	name?: string | null;
}

@Injectable()
export class WelcomeEmail {
	private readonly logger = new Logger(WelcomeEmail.name);

	constructor(private readonly emailDispatcher: EmailDispatcherService) {}

	async send(params: SendWelcomeEmailParams): Promise<void> {
		const name = params.name ?? 'there';
		const year = new Date().getFullYear();

		const htmlContent = `
			<!DOCTYPE html>
			<html>
			<head><meta charset="utf-8"></head>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
				<h2>Welcome, ${name}!</h2>
				<p>Your account has been created successfully.</p>
				<p>You can now sign in using your email: <strong>${params.email}</strong></p>
				<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
				<p style="font-size: 12px; color: #666;">&copy; ${year} All rights reserved.</p>
			</body>
			</html>
		`;

		const textContent = `Welcome, ${name}!\n\nYour account has been created successfully.\n\nYou can now sign in using your email: ${params.email}`;

		try {
			await this.emailDispatcher.sendEmail({
				to: [{ email: params.email, name: params.name ?? undefined }],
				subject: 'Welcome to our platform',
				htmlContent,
				textContent,
			});
		} catch (error) {
			this.logger.warn(`Failed to send welcome email: ${this.getErrorMessage(error)}`);
		}
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Unknown error';
	}
}
