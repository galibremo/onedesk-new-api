import { createHash } from 'crypto';
import nodemailer, { type Transporter } from 'nodemailer';

import { badGatewayError } from '../../../core/errors/domain-error';
import type {
	EmailProvider,
	SendEmailParams,
	TestConnectionResult,
} from '../email-provider.interface';
import type { NodemailerConfig } from '../smtp.types';

export class NodemailerProvider implements EmailProvider {
	readonly type = 'nodemailer' as const;

	private readonly transporters = new Map<string, Transporter>();

	async send(params: SendEmailParams, config: Record<string, unknown>): Promise<void> {
		const nodemailerConfig = config as unknown as NodemailerConfig;
		if (!nodemailerConfig.host || !nodemailerConfig.auth?.user || !nodemailerConfig.auth?.pass) {
			throw badGatewayError('nodemailer_config_missing', 'Nodemailer configuration is incomplete');
		}

		const transporter = this.getOrCreateTransporter(nodemailerConfig);

		try {
			await transporter.sendMail({
				from: `${nodemailerConfig.senderName} <${nodemailerConfig.senderEmail}>`,
				to: params.to.map(r => (r.name ? `${r.name} <${r.email}>` : r.email)),
				subject: params.subject,
				html: params.htmlContent,
				text: params.textContent,
				replyTo: params.replyTo
					? params.replyTo.name
						? `${params.replyTo.name} <${params.replyTo.email}>`
						: params.replyTo.email
					: undefined,
				headers: params.headers,
			});
		} catch {
			throw badGatewayError('nodemailer_email_failed', 'Failed to send email via SMTP');
		}
	}

	async testConnection(config: Record<string, unknown>): Promise<TestConnectionResult> {
		const nodemailerConfig = config as unknown as NodemailerConfig;
		if (!nodemailerConfig.host) {
			return { success: false, message: 'SMTP host is required' };
		}

		try {
			const transporter = nodemailer.createTransport({
				host: nodemailerConfig.host,
				port: nodemailerConfig.port,
				secure: nodemailerConfig.secure,
				auth: nodemailerConfig.auth,
			});

			await transporter.verify();
			return { success: true, message: 'SMTP connection successful' };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, message: `SMTP connection failed: ${message}` };
		}
	}

	private getOrCreateTransporter(config: NodemailerConfig): Transporter {
		const cacheKey = this.getConfigHash(config);

		if (this.transporters.has(cacheKey)) {
			return this.transporters.get(cacheKey)!;
		}

		const transporter = nodemailer.createTransport({
			host: config.host,
			port: config.port,
			secure: config.secure,
			auth: config.auth,
		});

		this.transporters.set(cacheKey, transporter);
		return transporter;
	}

	private getConfigHash(config: NodemailerConfig): string {
		const raw = `${config.host}:${config.port}:${config.secure}:${config.auth.user}:${config.auth.pass}`;
		return createHash('sha256').update(raw).digest('hex');
	}
}
