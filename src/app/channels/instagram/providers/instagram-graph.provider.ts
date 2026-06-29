import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

import type { EnvType } from '../../../../core/validators/env';
import { INSTAGRAM_OAUTH_DIALOG_URL, INSTAGRAM_PERMISSIONS } from '../constants/instagram.constants';
import type {
	OAuthUrlResult,
	InstagramAccountInfo,
	RefreshResult,
	TokenResult,
	InstagramProviderInterface,
} from '../interfaces/instagram-provider.interface';
import {
	exchangeCodeForToken,
	exchangeForLongLivedToken,
	getMetaUserId,
	getInstagramBusinessAccounts,
	revokeInstagramAccess,
	subscribePageToInstagramWebhook,
} from '../utils/instagram-graph.util';

@Injectable()
export class InstagramGraphProvider implements InstagramProviderInterface {
	constructor(
		private readonly configService: ConfigService<EnvType, true>,
		private readonly jwtService: JwtService,
	) {}

	async authenticate(userId: number): Promise<OAuthUrlResult> {
		const appId = this.configService.get('INSTAGRAM_APP_ID', { infer: true });
		const callbackUrl = this.configService.get('INSTAGRAM_CALLBACK_URL', { infer: true });
		const stateSecret = this.configService.get('INSTAGRAM_OAUTH_STATE_SECRET', { infer: true });

		const state = this.jwtService.sign(
			{ userId, nonce: randomBytes(16).toString('hex') },
			{ secret: stateSecret, expiresIn: '10m' },
		);

		const params = new URLSearchParams({
			client_id: appId!,
			redirect_uri: callbackUrl!,
			scope: INSTAGRAM_PERMISSIONS.join(','),
			state,
			response_type: 'code',
			auth_type: 'rerequest',
		});

		const url = `${INSTAGRAM_OAUTH_DIALOG_URL}?${params.toString()}`;
		return { url, state };
	}

	async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
		const appId = this.configService.get('INSTAGRAM_APP_ID', { infer: true })!;
		const appSecret = this.configService.get('INSTAGRAM_APP_SECRET', { infer: true })!;

		const shortToken = await exchangeCodeForToken(appId, appSecret, code, redirectUri);
		const longLived = await exchangeForLongLivedToken(appId, appSecret, shortToken.access_token);
		const instagramUserId = await getMetaUserId(longLived.accessToken);

		return {
			accessToken: longLived.accessToken,
			expiresAt: longLived.expiresAt,
			instagramUserId,
		};
	}

	async getInstagramAccounts(accessToken: string): Promise<InstagramAccountInfo[]> {
		return getInstagramBusinessAccounts(accessToken);
	}

	async refreshToken(accessToken: string): Promise<RefreshResult> {
		const appId = this.configService.get('INSTAGRAM_APP_ID', { infer: true })!;
		const appSecret = this.configService.get('INSTAGRAM_APP_SECRET', { infer: true })!;
		return exchangeForLongLivedToken(appId, appSecret, accessToken);
	}

	async disconnect(instagramUserId: string, accessToken: string): Promise<void> {
		await revokeInstagramAccess(instagramUserId, accessToken);
	}

	async subscribeWebhook(pageId: string, pageAccessToken: string): Promise<void> {
		await subscribePageToInstagramWebhook(pageId, pageAccessToken);
	}
}
