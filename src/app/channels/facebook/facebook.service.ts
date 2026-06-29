import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';

import { DomainError } from '../../../core/errors/domain-error';
import type { EnvType } from '../../../core/validators/env';
import { CryptoService } from '../../../core/crypto/crypto.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { UserWithoutPassword } from '../../auth/auth.types';
import type { OAuthCallbackDto, FacebookConnectPagesDto } from '../channels.schema';
import type {
	ChannelsListResponse,
	OAuthUrlResponse,
	RefreshTokenResponse,
} from '../channels.types';
import type { SocialProviderInterface } from './interfaces/facebook-provider.interface';
import { getGrantedPermissions } from './utils/facebook-graph.util';
import { FACEBOOK_AUDIT_ACTIONS, SOCIAL_PROVIDER_FACEBOOK } from './constants/facebook.constants';
import type { FacebookCallbackResponse } from './facebook.types';
import { mapPageInfoToResponse } from './facebook.mapper';
import { FacebookRepository } from './facebook.repository';

@Injectable()
export class FacebookService {
	private readonly logger = new Logger(FacebookService.name);

	constructor(
		@Inject(SOCIAL_PROVIDER_FACEBOOK)
		private readonly fbProvider: SocialProviderInterface,
		private readonly facebookRepository: FacebookRepository,
		private readonly cryptoService: CryptoService,
		private readonly jwtService: JwtService,
		private readonly auditLogService: AuditLogService,
		private readonly configService: ConfigService<EnvType, true>,
	) {}

	async generateOAuthUrl(userId: number): Promise<OAuthUrlResponse> {
		const { url } = await this.fbProvider.authenticate(userId);
		return { url };
	}

	async handleOAuthCallback(
		dto: OAuthCallbackDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<FacebookCallbackResponse> {
		const stateSecret = this.configService.get('FACEBOOK_OAUTH_STATE_SECRET', { infer: true });

		let statePayload: { userId: number; nonce: string };
		try {
			statePayload = this.jwtService.verify<{ userId: number; nonce: string }>(dto.state, {
				secret: stateSecret,
			});
		} catch {
			throw new DomainError(
				'invalid_state',
				'OAuth state is invalid or has expired',
				HttpStatus.BAD_REQUEST,
			);
		}

		if (statePayload.userId !== currentUser.id) {
			throw new DomainError(
				'invalid_state',
				'OAuth state does not match the current user',
				HttpStatus.BAD_REQUEST,
			);
		}

		const callbackUrl = this.configService.get('FACEBOOK_CALLBACK_URL', { infer: true })!;
		const { accessToken, expiresAt, facebookUserId } = await this.fbProvider.exchangeCode(
			dto.code,
			callbackUrl,
		);

		const encryptedToken = this.cryptoService.encrypt(accessToken);
		const account = await this.facebookRepository.upsertAccount({
			userId: currentUser.id,
			facebookUserId,
			accessToken: encryptedToken,
			tokenExpiration: expiresAt,
		});

		const granted = await getGrantedPermissions(accessToken);
		this.logger.debug(`Granted FB permissions: ${JSON.stringify(granted)}`);

		const pages = await this.fbProvider.getPages(accessToken);
		this.logger.debug(`Graph API returned ${pages.length} pages`);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: FACEBOOK_AUDIT_ACTIONS.OAUTH_CALLBACK,
			targetType: 'facebook_account',
			targetId: account.publicId,
			metadata: { pagesFound: pages.length },
			request,
		});

		const pageResponses = pages.map(mapPageInfoToResponse);

		return { accountId: account.publicId, pages: pageResponses };
	}

	async connectPages(
		dto: FacebookConnectPagesDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<ChannelsListResponse> {
		const account = await this.facebookRepository.findAccountByPublicId(
			dto.facebookAccountPublicId,
			currentUser.id,
		);
		if (!account) {
			throw new DomainError(
				'account_not_found',
				'Facebook account not found',
				HttpStatus.NOT_FOUND,
			);
		}

		const decryptedAccountToken = this.cryptoService.decrypt(account.accessToken);
		const allPages = await this.fbProvider.getPages(decryptedAccountToken);
		const selectedPages = allPages.filter(p => dto.pageIds.includes(p.pageId));

		for (const page of selectedPages) {
			await this.facebookRepository.upsertChannel({
				userId: currentUser.id,
				name: page.pageName,
				config: {
					facebookPageId: page.pageId,
					facebookUserId: account.facebookUserId,
					facebookAccountPublicId: account.publicId,
					pageAccessToken: this.cryptoService.encrypt(page.pageAccessToken),
					pageCategory: page.pageCategory,
					profilePicture: page.profilePicture,
				},
			});
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: FACEBOOK_AUDIT_ACTIONS.PAGES_CONNECTED,
			targetType: 'facebook_account',
			targetId: account.publicId,
			metadata: { connectedPageIds: dto.pageIds },
			request,
		});

		return { rows: [], total: 0, page: 1, pageSize: 50 };
	}

	async refreshToken(
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<RefreshTokenResponse> {
		const account = await this.facebookRepository.findAccountByUserId(currentUser.id);
		if (!account) {
			throw new DomainError(
				'account_not_found',
				'No Facebook account connected',
				HttpStatus.NOT_FOUND,
			);
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const { accessToken: newToken, expiresAt } = await this.fbProvider.refreshToken(decryptedToken);

		const encryptedToken = this.cryptoService.encrypt(newToken);
		await this.facebookRepository.updateAccountToken(account.id, encryptedToken, expiresAt);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: FACEBOOK_AUDIT_ACTIONS.TOKEN_REFRESHED,
			targetType: 'facebook_account',
			targetId: account.publicId,
			metadata: {},
			request,
		});

		return { refreshed: true };
	}
}
