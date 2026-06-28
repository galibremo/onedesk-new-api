import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

import { badGatewayError } from '../../../core/errors/domain-error';
import type {
	EmailProvider,
	SendEmailParams,
	TestConnectionResult,
} from '../email-provider.interface';
import type { AwsSesConfig } from '../smtp.types';

export class AwsSesProvider implements EmailProvider {
	readonly type = 'aws-ses' as const;

	async send(params: SendEmailParams, config: Record<string, unknown>): Promise<void> {
		const sesConfig = config as unknown as AwsSesConfig;
		if (!sesConfig.accessKeyId || !sesConfig.secretAccessKey || !sesConfig.region) {
			throw badGatewayError('aws_ses_config_missing', 'AWS SES configuration is incomplete');
		}

		const client = new SESClient({
			region: sesConfig.region,
			credentials: {
				accessKeyId: sesConfig.accessKeyId,
				secretAccessKey: sesConfig.secretAccessKey,
			},
		});

		try {
			const command = new SendEmailCommand({
				Source: `${sesConfig.senderName} <${sesConfig.senderEmail}>`,
				Destination: {
					ToAddresses: params.to.map(r => r.email),
				},
				Message: {
					Subject: { Data: params.subject, Charset: 'UTF-8' },
					Body: {
						Html: params.htmlContent ? { Data: params.htmlContent, Charset: 'UTF-8' } : undefined,
						Text: params.textContent ? { Data: params.textContent, Charset: 'UTF-8' } : undefined,
					},
				},
				ReplyToAddresses: params.replyTo ? [params.replyTo.email] : undefined,
			});

			await client.send(command);
		} catch {
			throw badGatewayError('aws_ses_email_failed', 'Failed to send email via AWS SES');
		}
	}

	async testConnection(config: Record<string, unknown>): Promise<TestConnectionResult> {
		const sesConfig = config as unknown as AwsSesConfig;
		if (!sesConfig.accessKeyId || !sesConfig.region) {
			return { success: false, message: 'AWS SES access key and region are required' };
		}

		try {
			const { SESClient, GetSendQuotaCommand } = await import('@aws-sdk/client-ses');
			const client = new SESClient({
				region: sesConfig.region,
				credentials: {
					accessKeyId: sesConfig.accessKeyId,
					secretAccessKey: sesConfig.secretAccessKey,
				},
			});

			const command = new GetSendQuotaCommand({});
			await client.send(command);
			return { success: true, message: 'AWS SES connection successful' };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, message: `AWS SES connection failed: ${message}` };
		}
	}
}
