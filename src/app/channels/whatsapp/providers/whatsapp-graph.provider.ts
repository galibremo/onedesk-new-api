import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

import type { EnvType } from '../../../../core/validators/env';
import { WHATSAPP_OAUTH_DIALOG_URL, WHATSAPP_PERMISSIONS } from '../constants/whatsapp.constants';
import type {
	OAuthUrlResult,
	WhatsAppPhoneInfo,
	RefreshResult,
	TokenResult,
	WhatsAppProviderInterface,
} from '../interfaces/whatsapp-provider.interface';
import {
	exchangeCodeForToken,
	exchangeForLongLivedToken,
	getMetaUserId,
	getWabaPhoneNumbers,
	revokeWhatsAppAccess,
	subscribeWabaToWebhook,
} from '../utils/whatsapp-graph.util';

@Injectable()
export class WhatsAppGraphProvider implements WhatsAppProviderInterface {
	constructor(
		private readonly configService: ConfigService<EnvType, true>,
		private readonly jwtService: JwtService,
	) {}

	async authenticate(userId: number): Promise<OAuthUrlResult> {
		const appId = this.configService.get('WHATSAPP_APP_ID', { infer: true });
		const callbackUrl = this.configService.get('WHATSAPP_CALLBACK_URL', { infer: true });
		const stateSecret = this.configService.get('WHATSAPP_OAUTH_STATE_SECRET', { infer: true });

		const state = this.jwtService.sign(
			{ userId, nonce: randomBytes(16).toString('hex') },
			{ secret: stateSecret, expiresIn: '10m' },
		);

		const params = new URLSearchParams({
			client_id: appId!,
			redirect_uri: callbackUrl!,
			scope: WHATSAPP_PERMISSIONS.join(','),
			state,
			response_type: 'code',
			auth_type: 'rerequest',
		});

		const url = `${WHATSAPP_OAUTH_DIALOG_URL}?${params.toString()}`;
		return { url, state };
	}

	async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
		const appId = this.configService.get('WHATSAPP_APP_ID', { infer: true })!;
		const appSecret = this.configService.get('WHATSAPP_APP_SECRET', { infer: true })!;

		const shortToken = await exchangeCodeForToken(appId, appSecret, code, redirectUri);
		const longLived = await exchangeForLongLivedToken(appId, appSecret, shortToken.access_token);
		const whatsappUserId = await getMetaUserId(longLived.accessToken);

		return {
			accessToken: longLived.accessToken,
			expiresAt: longLived.expiresAt,
			whatsappUserId,
		};
	}

	async getPhoneNumbers(accessToken: string): Promise<WhatsAppPhoneInfo[]> {
		return getWabaPhoneNumbers(accessToken);
	}

	async refreshToken(accessToken: string): Promise<RefreshResult> {
		const appId = this.configService.get('WHATSAPP_APP_ID', { infer: true })!;
		const appSecret = this.configService.get('WHATSAPP_APP_SECRET', { infer: true })!;
		return exchangeForLongLivedToken(appId, appSecret, accessToken);
	}

	async disconnect(whatsappUserId: string, accessToken: string): Promise<void> {
		await revokeWhatsAppAccess(whatsappUserId, accessToken);
	}

	async subscribeWebhook(wabaId: string, accessToken: string): Promise<void> {
		await subscribeWabaToWebhook(wabaId, accessToken);
	}
}
