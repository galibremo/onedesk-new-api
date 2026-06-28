import { Injectable, Logger } from '@nestjs/common';

import { badGatewayError } from '../../../core/errors/domain-error';
import { CryptoService } from '../../../core/crypto/crypto.service';
import type { SmtpProviderSchemaType } from '../../../core/database/types';
import type { TemplateKey, TemplateVariableMap } from '../../email-template/email-template.registry';
import { EmailTemplateService } from '../../email-template/email-template.service';
import { EmailLogsService } from '../../email-logs/email-logs.service';
import type { EmailProvider, SendEmailParams } from '../email-provider.interface';
import { AwsSesProvider } from '../providers/aws-ses.provider';
import { BrevoProvider } from '../providers/brevo.provider';
import { NodemailerProvider } from '../providers/nodemailer.provider';
import { ResendProvider } from '../providers/resend.provider';
import { SmtpProvidersService } from './smtp-providers.service';

@Injectable()
export class EmailDispatcherService {
	private readonly logger = new Logger(EmailDispatcherService.name);

	private readonly providers: Map<string, EmailProvider>;

	constructor(
		private readonly smtpProvidersService: SmtpProvidersService,
		private readonly cryptoService: CryptoService,
		private readonly templateService: EmailTemplateService,
		private readonly emailLogsService: EmailLogsService,
	) {
		this.providers = new Map<string, EmailProvider>();
		this.registerProvider(new BrevoProvider());
		this.registerProvider(new ResendProvider());
		this.registerProvider(new NodemailerProvider());
		this.registerProvider(new AwsSesProvider());
	}

	private registerProvider(provider: EmailProvider): void {
		this.providers.set(provider.type, provider);
	}

	async sendEmail(params: SendEmailParams, templateKey?: string): Promise<void> {
		const activeProviders = await this.smtpProvidersService.getAllActiveProviders();

		if (activeProviders.length === 0) {
			this.logger.warn('[EmailDispatcher] No active SMTP providers configured — email not sent');
			return;
		}

		const failures: { name: string; type: string; error: string }[] = [];

		for (const providerRecord of activeProviders) {
			try {
				const decryptedConfig = JSON.parse(
				this.cryptoService.decrypt(providerRecord.config),
			) as Record<string, unknown>;

				const provider = this.providers.get(providerRecord.providerType);
				if (!provider) {
					this.logger.warn(
						`[EmailDispatcher] Unknown provider type "${providerRecord.providerType}" for "${providerRecord.name}" — skipping`,
					);
					continue;
				}

				await provider.send(params, decryptedConfig);
				this.logger.log(
					`[EmailDispatcher] Email sent successfully via "${providerRecord.name}" (${providerRecord.providerType})`,
				);

				await this.logSendResults(providerRecord, params, templateKey, 'sent');
				return;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				failures.push({
					name: providerRecord.name,
					type: providerRecord.providerType,
					error: errorMessage,
				});
				this.logger.warn(
					`[EmailDispatcher] Provider "${providerRecord.name}" (${providerRecord.providerType}) failed: ${errorMessage}`,
				);

				await this.logSendResults(providerRecord, params, templateKey, 'failed', errorMessage);
			}
		}

		if (failures.length > 0) {
			throw badGatewayError('email_send_failed', 'All SMTP providers failed to send email', {
				failures,
			});
		}
	}

	async sendFromTemplate<K extends string>(params: {
		templateKey: K;
		to: { email: string; name?: string }[];
		params: K extends TemplateKey ? TemplateVariableMap[K] : Record<string, unknown>;
		replyTo?: { email: string; name?: string };
		headers?: Record<string, string>;
	}): Promise<void> {
		const rendered = await this.templateService.render(params.templateKey, params.params);

		await this.sendEmail(
			{
				to: params.to,
				subject: rendered.subject,
				htmlContent: rendered.html,
				textContent: rendered.text,
				replyTo: params.replyTo,
				headers: {
					...params.headers,
					'X-Template-Version': String(rendered.version),
				},
			},
			params.templateKey,
		);
	}

	private async logSendResults(
		providerRecord: SmtpProviderSchemaType,
		params: SendEmailParams,
		templateKey: string | undefined,
		status: 'sent' | 'failed',
		errorMessage?: string,
	): Promise<void> {
		for (const recipient of params.to) {
			await this.emailLogsService.createLog({
				smtpProviderId: providerRecord.id,
				toEmail: recipient.email,
				toName: recipient.name,
				subject: params.subject,
				templateKey,
				status,
				errorMessage,
			});
		}
	}
}
