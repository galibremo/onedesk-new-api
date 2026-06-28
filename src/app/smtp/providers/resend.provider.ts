import { Resend, type CreateEmailOptions } from 'resend';

import { badGatewayError } from '../../../core/errors/domain-error';
import type {
	EmailProvider,
	SendEmailParams,
	TestConnectionResult,
} from '../email-provider.interface';
import type { ResendConfig } from '../smtp.types';

export class ResendProvider implements EmailProvider {
	readonly type = 'resend' as const;

	async send(params: SendEmailParams, config: Record<string, unknown>): Promise<void> {
		const resendConfig = config as unknown as ResendConfig;
		if (!resendConfig.apiKey) {
			throw badGatewayError('resend_config_missing', 'Resend API key is not configured');
		}

		const resend = new Resend(resendConfig.apiKey);

		try {
			const { error } = await resend.emails.send({
				from: `${resendConfig.senderName} <${resendConfig.senderEmail}>`,
				to: params.to.map(r => (r.name ? `${r.name} <${r.email}>` : r.email)),
				subject: params.subject,
				...(params.htmlContent ? { html: params.htmlContent } : {}),
				...(params.textContent ? { text: params.textContent } : {}),
				...(params.replyTo
					? {
							replyTo: params.replyTo.name
								? `${params.replyTo.name} <${params.replyTo.email}>`
								: params.replyTo.email,
						}
					: {}),
			...(params.headers ? { headers: params.headers } : {}),
		} as CreateEmailOptions);

			if (error) {
				throw badGatewayError(
					'resend_email_failed',
					`Failed to send email via Resend: ${error.message}`,
				);
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes('Failed to send email via Resend')) {
				throw error;
			}
			throw badGatewayError('resend_email_failed', 'Failed to send email via Resend');
		}
	}

	async testConnection(config: Record<string, unknown>): Promise<TestConnectionResult> {
		const resendConfig = config as unknown as ResendConfig;
		if (!resendConfig.apiKey) {
			return { success: false, message: 'Resend API key is required' };
		}

		try {
			const resend = new Resend(resendConfig.apiKey);
			// Resend doesn't have a dedicated "ping" endpoint, but we can validate the key
			// by attempting to list domains (lightweight call)
			const { error } = await resend.domains.list();
			if (error) {
				return { success: false, message: `Resend connection failed: ${error.message}` };
			}
			return { success: true, message: 'Resend connection successful' };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, message: `Resend connection failed: ${message}` };
		}
	}
}
