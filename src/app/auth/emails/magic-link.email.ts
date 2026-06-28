import { Injectable } from '@nestjs/common';

import { badGatewayError } from '../../../core/errors/domain-error';
import { magicLinkTimeout } from '../../../common/helpers/constant.helper';
import { EmailDispatcherService } from '../../smtp/services/email-dispatcher.service';

interface SendMagicLinkEmailParams {
	email: string;
	verificationUrl: string;
	redirectUrl: string;
}

const minuteMs = 1000 * 60;

@Injectable()
export class MagicLinkEmail {
	constructor(private readonly emailDispatcher: EmailDispatcherService) {}

	async send(params: SendMagicLinkEmailParams): Promise<void> {
		const expiresInMinutes = Math.floor(magicLinkTimeout / minuteMs);
		const year = new Date().getFullYear();

		const htmlContent = `
			<!DOCTYPE html>
			<html>
			<head><meta charset="utf-8"></head>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
				<h2>Sign in to your account</h2>
				<p>Click the link below to sign in:</p>
				<p><a href="${params.verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 4px;">Sign In</a></p>
				<p>This link will expire in ${expiresInMinutes} minutes.</p>
				<p>If you didn't request this, you can safely ignore this email.</p>
				<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
				<p style="font-size: 12px; color: #666;">&copy; ${year} All rights reserved.</p>
			</body>
			</html>
		`;

		const textContent = `Sign in to your account\n\nClick the link below to sign in:\n${params.verificationUrl}\n\nThis link will expire in ${expiresInMinutes} minutes.\n\nIf you didn't request this, you can safely ignore this email.`;

		try {
			await this.emailDispatcher.sendEmail({
				to: [{ email: params.email }],
				subject: 'Sign in to your account',
				htmlContent,
				textContent,
			});
		} catch {
			throw badGatewayError('magic_link_email_failed', 'Failed to send magic link email');
		}
	}
}
