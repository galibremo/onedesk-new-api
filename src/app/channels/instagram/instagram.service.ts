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
import type { OAuthCallbackDto, InstagramConnectAccountsDto } from '../channels.schema';
import type { ChannelsListResponse, OAuthUrlResponse, RefreshTokenResponse } from '../channels.types';
import type { InstagramProviderInterface } from './interfaces/instagram-provider.interface';
import { INSTAGRAM_AUDIT_ACTIONS, SOCIAL_PROVIDER_INSTAGRAM } from './constants/instagram.constants';
import type { InstagramCallbackResponse } from './instagram.types';
import { InstagramRepository } from './instagram.repository';

@Injectable()
export class InstagramService {
	private readonly logger = new Logger(InstagramService.name);

	constructor(
		@Inject(SOCIAL_PROVIDER_INSTAGRAM)
		private readonly igProvider: InstagramProviderInterface,
		private readonly instagramRepository: InstagramRepository,
		private readonly cryptoService: CryptoService,
		private readonly jwtService: JwtService,
		private readonly auditLogService: AuditLogService,
		private readonly configService: ConfigService<EnvType, true>,
	) {}

	async generateOAuthUrl(userId: number): Promise<OAuthUrlResponse> {
		const { url } = await this.igProvider.authenticate(userId);
		return { url };
	}

	async handleOAuthCallback(
		dto: OAuthCallbackDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<InstagramCallbackResponse> {
		const stateSecret = this.configService.get('INSTAGRAM_OAUTH_STATE_SECRET', { infer: true })!;

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

		const callbackUrl = this.configService.get('INSTAGRAM_CALLBACK_URL', { infer: true })!;
		const { accessToken, expiresAt, instagramUserId } = await this.igProvider.exchangeCode(
			dto.code,
			callbackUrl,
		);

		const encryptedToken = this.cryptoService.encrypt(accessToken);
		const account = await this.instagramRepository.upsertAccount({
			userId: currentUser.id,
			instagramUserId,
			accessToken: encryptedToken,
			tokenExpiration: expiresAt,
		});

		const igAccounts = await this.igProvider.getInstagramAccounts(accessToken);
		this.logger.debug(`Graph API returned ${igAccounts.length} Instagram accounts`);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: INSTAGRAM_AUDIT_ACTIONS.OAUTH_CALLBACK,
			targetType: 'instagram_account',
			targetId: account.publicId,
			metadata: { accountsFound: igAccounts.length },
			request,
		});

		const accountResponses: InstagramCallbackResponse['accounts'] = igAccounts.map(a => ({
			instagramAccountId: a.instagramAccountId,
			instagramUsername: a.instagramUsername,
			instagramName: a.instagramName,
			profilePictureUrl: a.profilePictureUrl,
			followersCount: a.followersCount,
			facebookPageId: a.facebookPageId,
			facebookPageName: a.facebookPageName,
		}));

		return { accountId: account.publicId, accounts: accountResponses };
	}

	async connectAccounts(
		dto: InstagramConnectAccountsDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<ChannelsListResponse> {
		const account = await this.instagramRepository.findAccountByPublicId(
			dto.instagramAccountPublicId,
			currentUser.id,
		);
		if (!account) {
			throw new DomainError('account_not_found', 'Instagram account not found', HttpStatus.NOT_FOUND);
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const allAccounts = await this.igProvider.getInstagramAccounts(decryptedToken);
		const selectedAccounts = allAccounts.filter(a =>
			dto.instagramAccountIds.includes(a.instagramAccountId),
		);

		for (const igAccount of selectedAccounts) {
			const encryptedPageToken = this.cryptoService.encrypt(igAccount.pageAccessToken);

			await this.instagramRepository.upsertChannel({
				userId: currentUser.id,
				name: `@${igAccount.instagramUsername}`,
				config: {
					instagramAccountId: igAccount.instagramAccountId,
					instagramUsername: igAccount.instagramUsername,
					instagramName: igAccount.instagramName,
					profilePictureUrl: igAccount.profilePictureUrl,
					followersCount: igAccount.followersCount,
					facebookPageId: igAccount.facebookPageId,
					facebookPageName: igAccount.facebookPageName,
					instagramUserId: account.instagramUserId,
					instagramAccountPublicId: account.publicId,
					pageAccessToken: encryptedPageToken,
				},
			});

			try {
				await this.igProvider.subscribeWebhook(igAccount.facebookPageId, igAccount.pageAccessToken);
			} catch (err) {
				this.logger.warn(
					`Failed to subscribe page ${igAccount.facebookPageId} to Instagram webhook: ${err}`,
				);
			}
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: INSTAGRAM_AUDIT_ACTIONS.ACCOUNTS_CONNECTED,
			targetType: 'instagram_account',
			targetId: account.publicId,
			metadata: { connectedInstagramAccountIds: dto.instagramAccountIds },
			request,
		});

		return { rows: [], total: 0, page: 1, pageSize: 50 };
	}

	async refreshToken(
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<RefreshTokenResponse> {
		const account = await this.instagramRepository.findAccountByUserId(currentUser.id);
		if (!account) {
			throw new DomainError('account_not_found', 'No Instagram account connected', HttpStatus.NOT_FOUND);
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const { accessToken: newToken, expiresAt } = await this.igProvider.refreshToken(decryptedToken);

		const encryptedToken = this.cryptoService.encrypt(newToken);
		await this.instagramRepository.updateAccountToken(
			account.id,
			encryptedToken,
			expiresAt,
		);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: INSTAGRAM_AUDIT_ACTIONS.TOKEN_REFRESHED,
			targetType: 'instagram_account',
			targetId: account.publicId,
			metadata: {},
			request,
		});

		return { refreshed: true };
	}
}
