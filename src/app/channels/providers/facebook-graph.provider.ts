import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

import type { EnvType } from '../../../core/validators/env';
import { FACEBOOK_OAUTH_DIALOG_URL, FACEBOOK_PERMISSIONS } from '../constants/facebook.constants';
import type {
	OAuthUrlResult,
	PageInfo,
	RefreshResult,
	SocialProviderInterface,
	TokenResult,
} from '../interfaces/social-provider.interface';
import {
	exchangeCodeForToken,
	exchangeForLongLivedToken,
	getFacebookUserId,
	getManagedPages,
	revokeAppAccess,
	subscribePageToWebhook,
} from '../utils/facebook-graph.util';

@Injectable()
export class FacebookGraphProvider implements SocialProviderInterface {
	constructor(
		private readonly configService: ConfigService<EnvType, true>,
		private readonly jwtService: JwtService,
	) {}

	async authenticate(userId: number): Promise<OAuthUrlResult> {
		const appId = this.configService.get('FACEBOOK_APP_ID', { infer: true });
		const callbackUrl = this.configService.get('FACEBOOK_CALLBACK_URL', { infer: true });
		const stateSecret = this.configService.get('FACEBOOK_OAUTH_STATE_SECRET', { infer: true });

		const state = this.jwtService.sign(
			{ userId, nonce: randomBytes(16).toString('hex') },
			{ secret: stateSecret, expiresIn: '10m' },
		);

		const params = new URLSearchParams({
			client_id: appId!,
			redirect_uri: callbackUrl!,
			scope: FACEBOOK_PERMISSIONS.join(','),
			state,
			response_type: 'code',
			auth_type: 'rerequest',
		});

		const url = `${FACEBOOK_OAUTH_DIALOG_URL}?${params.toString()}`;
		return { url, state };
	}

	async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
		const appId = this.configService.get('FACEBOOK_APP_ID', { infer: true })!;
		const appSecret = this.configService.get('FACEBOOK_APP_SECRET', { infer: true })!;

		const shortToken = await exchangeCodeForToken(appId, appSecret, code, redirectUri);
		const longLived = await exchangeForLongLivedToken(
			appId,
			appSecret,
			shortToken.access_token,
		);
		const facebookUserId = await getFacebookUserId(longLived.accessToken);

		return {
			accessToken: longLived.accessToken,
			expiresAt: longLived.expiresAt,
			facebookUserId,
		};
	}

	async getPages(accessToken: string): Promise<PageInfo[]> {
		return getManagedPages(accessToken);
	}

	async refreshToken(accessToken: string): Promise<RefreshResult> {
		const appId = this.configService.get('FACEBOOK_APP_ID', { infer: true })!;
		const appSecret = this.configService.get('FACEBOOK_APP_SECRET', { infer: true })!;
		return exchangeForLongLivedToken(appId, appSecret, accessToken);
	}

	async disconnect(facebookUserId: string, accessToken: string): Promise<void> {
		await revokeAppAccess(facebookUserId, accessToken);
	}

	async subscribeWebhook(
		pageId: string,
		pageAccessToken: string,
		fields: string[],
	): Promise<void> {
		await subscribePageToWebhook(pageId, pageAccessToken, fields);
	}
}
