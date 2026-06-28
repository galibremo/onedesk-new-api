import { BrevoClient } from '@getbrevo/brevo';

import { badGatewayError } from '../../../core/errors/domain-error';
import type {
	EmailProvider,
	SendEmailParams,
	TestConnectionResult,
} from '../email-provider.interface';
import type { BrevoConfig } from '../smtp.types';

export class BrevoProvider implements EmailProvider {
	readonly type = 'brevo' as const;

	async send(params: SendEmailParams, config: Record<string, unknown>): Promise<void> {
		const brevoConfig = config as unknown as BrevoConfig;
		if (!brevoConfig.apiKey) {
			throw badGatewayError('brevo_config_missing', 'Brevo API key is not configured');
		}

		const client = new BrevoClient({ apiKey: brevoConfig.apiKey });

		try {
			await client.transactionalEmails.sendTransacEmail({
				sender: { email: brevoConfig.senderEmail, name: brevoConfig.senderName },
				to: params.to,
				subject: params.subject,
				htmlContent: params.htmlContent,
				textContent: params.textContent,
				replyTo: params.replyTo,
				headers: params.headers,
			});
		} catch {
			throw badGatewayError('brevo_email_failed', 'Failed to send email via Brevo');
		}
	}

	async testConnection(config: Record<string, unknown>): Promise<TestConnectionResult> {
		const brevoConfig = config as unknown as BrevoConfig;
		if (!brevoConfig.apiKey) {
			return { success: false, message: 'Brevo API key is required' };
		}

		try {
			const client = new BrevoClient({ apiKey: brevoConfig.apiKey });
			await client.account.getAccount();
			return { success: true, message: 'Brevo connection successful' };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, message: `Brevo connection failed: ${message}` };
		}
	}
}
