import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';

import { DomainError, notFoundError } from '../../core/errors/domain-error';
import type { EnvType } from '../../core/validators/env';
import { CryptoService } from '../../core/crypto/crypto.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { UserWithoutPassword } from '../auth/auth.types';
import { ChannelsRepository } from './channels.repository';
import type {
	ChannelsListQueryDto,
	OAuthCallbackDto,
	FacebookConnectPagesDto,
	InstagramConnectAccountsDto,
	WhatsappConnectPhonesDto,
} from './channels.schema';
import { mapChannelResponse } from './channels.mapper';
import type {
	ChannelsListResponse,
	DisconnectChannelResponse,
	FacebookChannelCredentials,
	OAuthUrlResponse,
	RefreshTokenResponse,
	FacebookPageInfoResponse,
	FacebookCallbackResponse,
	InstagramAccountInfoResponse,
	InstagramCallbackResponse,
	WhatsAppPhoneInfoResponse,
	WhatsAppCallbackResponse,
} from './channels.types';
import { FACEBOOK_AUDIT_ACTIONS, SOCIAL_PROVIDER_FACEBOOK } from './constants/facebook.constants';
import {
	INSTAGRAM_AUDIT_ACTIONS,
	SOCIAL_PROVIDER_INSTAGRAM,
} from './constants/instagram.constants';
import { WHATSAPP_AUDIT_ACTIONS, SOCIAL_PROVIDER_WHATSAPP } from './constants/whatsapp.constants';
import type { SocialProviderInterface } from './interfaces/social-provider.interface';
import type { InstagramProviderInterface } from './interfaces/instagram-provider.interface';
import type { WhatsAppProviderInterface } from './interfaces/whatsapp-provider.interface';
import { getGrantedPermissions } from './utils/facebook-graph.util';
import { FacebookChannelConfig } from './interfaces/config.interface';

@Injectable()
export class ChannelsService {
	private readonly logger = new Logger(ChannelsService.name);

	constructor(
		@Inject(SOCIAL_PROVIDER_FACEBOOK)
		private readonly fbProvider: SocialProviderInterface,
		@Inject(SOCIAL_PROVIDER_INSTAGRAM)
		private readonly igProvider: InstagramProviderInterface,
		@Inject(SOCIAL_PROVIDER_WHATSAPP)
		private readonly waProvider: WhatsAppProviderInterface,
		private readonly channelsRepository: ChannelsRepository,
		private readonly cryptoService: CryptoService,
		private readonly jwtService: JwtService,
		private readonly auditLogService: AuditLogService,
		private readonly configService: ConfigService<EnvType, true>,
	) {}

	// ── Core Channel Operations ──────────────────────────────────────────

	async listChannels(userId: number, query: ChannelsListQueryDto): Promise<ChannelsListResponse> {
		const { rows, total, page, pageSize } = await this.channelsRepository.listChannels(
			userId,
			query,
		);
		return { rows: rows.map(mapChannelResponse), total, page, pageSize };
	}

	async disconnectChannel(
		channelPublicId: string,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<DisconnectChannelResponse> {
		const channel = await this.channelsRepository.findByPublicId(channelPublicId, currentUser.id);
		if (!channel) {
			throw notFoundError('channel_not_found', 'Channel not found');
		}

		await this.channelsRepository.softDelete(channel.id);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'CHANNEL_DISCONNECTED',
			targetType: 'channel',
			targetId: channel.publicId,
			metadata: { channelType: channel.channelType, name: channel.name },
			request,
		});

		return { disconnected: true };
	}

	/**
	 * Returns decrypted Facebook page credentials for use by other modules.
	 * Never call this from a controller — credentials must not reach the HTTP layer.
	 */
	async getFacebookChannelCredentials(
		userId: number,
		channelPublicId: string,
	): Promise<FacebookChannelCredentials | null> {
		const channel = await this.channelsRepository.findByPublicId(channelPublicId, userId);
		if (!channel || channel.channelType !== 'facebook') return null;

		const config = channel.channelConfig as FacebookChannelConfig | null;
		if (!config) return null;

		return {
			facebookPageId: config.facebookPageId,
			pageAccessToken: this.cryptoService.decrypt(config.pageAccessToken),
		};
	}

	// ── Facebook OAuth ───────────────────────────────────────────────────

	async generateFacebookOAuthUrl(userId: number): Promise<OAuthUrlResponse> {
		const { url } = await this.fbProvider.authenticate(userId);
		return { url };
	}

	async handleFacebookOAuthCallback(
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
		const account = await this.channelsRepository.upsertFacebookAccount({
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

		const pageResponses: FacebookPageInfoResponse[] = pages.map(page => ({
			facebookPageId: page.pageId,
			pageName: page.pageName,
			pageCategory: page.pageCategory,
			profilePicture: page.profilePicture,
		}));

		return { accountId: account.publicId, pages: pageResponses };
	}

	async connectFacebookPages(
		dto: FacebookConnectPagesDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<ChannelsListResponse> {
		const account = await this.channelsRepository.findFacebookAccountByPublicId(
			dto.facebookAccountPublicId,
			currentUser.id,
		);
		if (!account) {
			throw notFoundError('account_not_found', 'Facebook account not found');
		}

		const decryptedAccountToken = this.cryptoService.decrypt(account.accessToken);
		const allPages = await this.fbProvider.getPages(decryptedAccountToken);
		const selectedPages = allPages.filter(p => dto.pageIds.includes(p.pageId));

		for (const page of selectedPages) {
			await this.channelsRepository.upsertFacebookChannel({
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

		const { rows, total, page, pageSize } = await this.channelsRepository.listChannels(
			currentUser.id,
			{ page: 1, pageSize: 50, sort: undefined, dir: undefined },
		);

		return { rows: rows.map(mapChannelResponse), total, page, pageSize };
	}

	async refreshFacebookToken(
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<RefreshTokenResponse> {
		const account = await this.channelsRepository.findFacebookAccountByUserId(currentUser.id);
		if (!account) {
			throw notFoundError('account_not_found', 'No Facebook account connected');
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const { accessToken: newToken, expiresAt } = await this.fbProvider.refreshToken(decryptedToken);

		const encryptedToken = this.cryptoService.encrypt(newToken);
		await this.channelsRepository.updateFacebookAccountToken(account.id, encryptedToken, expiresAt);

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

	// ── Instagram OAuth ──────────────────────────────────────────────────

	async generateInstagramOAuthUrl(userId: number): Promise<OAuthUrlResponse> {
		const { url } = await this.igProvider.authenticate(userId);
		return { url };
	}

	async handleInstagramOAuthCallback(
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
		const account = await this.channelsRepository.upsertInstagramAccount({
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

		const accountResponses: InstagramAccountInfoResponse[] = igAccounts.map(a => ({
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

	async connectInstagramAccounts(
		dto: InstagramConnectAccountsDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<ChannelsListResponse> {
		const account = await this.channelsRepository.findInstagramAccountByPublicId(
			dto.instagramAccountPublicId,
			currentUser.id,
		);
		if (!account) {
			throw notFoundError('account_not_found', 'Instagram account not found');
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const allAccounts = await this.igProvider.getInstagramAccounts(decryptedToken);
		const selectedAccounts = allAccounts.filter(a =>
			dto.instagramAccountIds.includes(a.instagramAccountId),
		);

		for (const igAccount of selectedAccounts) {
			const encryptedPageToken = this.cryptoService.encrypt(igAccount.pageAccessToken);

			await this.channelsRepository.upsertInstagramChannel({
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

		const { rows, total, page, pageSize } = await this.channelsRepository.listChannels(
			currentUser.id,
			{ page: 1, pageSize: 50, sort: undefined, dir: undefined },
		);

		return { rows: rows.map(mapChannelResponse), total, page, pageSize };
	}

	async refreshInstagramToken(
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<RefreshTokenResponse> {
		const account = await this.channelsRepository.findInstagramAccountByUserId(currentUser.id);
		if (!account) {
			throw notFoundError('account_not_found', 'No Instagram account connected');
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const { accessToken: newToken, expiresAt } = await this.igProvider.refreshToken(decryptedToken);

		const encryptedToken = this.cryptoService.encrypt(newToken);
		await this.channelsRepository.updateInstagramAccountToken(
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

	// ── WhatsApp OAuth ───────────────────────────────────────────────────

	async generateWhatsAppOAuthUrl(userId: number): Promise<OAuthUrlResponse> {
		const { url } = await this.waProvider.authenticate(userId);
		return { url };
	}

	async handleWhatsAppOAuthCallback(
		dto: OAuthCallbackDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<WhatsAppCallbackResponse> {
		const stateSecret = this.configService.get('WHATSAPP_OAUTH_STATE_SECRET', { infer: true })!;

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

		const callbackUrl = this.configService.get('WHATSAPP_CALLBACK_URL', { infer: true })!;
		const { accessToken, expiresAt, whatsappUserId } = await this.waProvider.exchangeCode(
			dto.code,
			callbackUrl,
		);

		const encryptedToken = this.cryptoService.encrypt(accessToken);
		const account = await this.channelsRepository.upsertWhatsAppAccount({
			userId: currentUser.id,
			whatsappUserId,
			accessToken: encryptedToken,
			tokenExpiration: expiresAt,
		});

		const phoneNumbers = await this.waProvider.getPhoneNumbers(accessToken);
		this.logger.debug(`Graph API returned ${phoneNumbers.length} WhatsApp phone numbers`);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: WHATSAPP_AUDIT_ACTIONS.OAUTH_CALLBACK,
			targetType: 'whatsapp_account',
			targetId: account.publicId,
			metadata: { phoneNumbersFound: phoneNumbers.length },
			request,
		});

		const phoneResponses: WhatsAppPhoneInfoResponse[] = phoneNumbers.map(p => ({
			phoneNumberId: p.phoneNumberId,
			displayPhoneNumber: p.displayPhoneNumber,
			verifiedName: p.verifiedName,
			wabaId: p.wabaId,
			phoneNumberStatus: p.phoneNumberStatus,
		}));

		return { accountId: account.publicId, phoneNumbers: phoneResponses };
	}

	async connectWhatsAppPhones(
		dto: WhatsappConnectPhonesDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<ChannelsListResponse> {
		const account = await this.channelsRepository.findWhatsAppAccountByPublicId(
			dto.whatsappAccountPublicId,
			currentUser.id,
		);
		if (!account) {
			throw notFoundError('account_not_found', 'WhatsApp account not found');
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const allPhones = await this.waProvider.getPhoneNumbers(decryptedToken);
		const selectedPhones = allPhones.filter(p => dto.phoneNumberIds.includes(p.phoneNumberId));

		const subscribedWabaIds = new Set<string>();

		for (const phone of selectedPhones) {
			await this.channelsRepository.upsertWhatsAppChannel({
				userId: currentUser.id,
				name: `${phone.verifiedName} (${phone.displayPhoneNumber})`,
				config: {
					phoneNumberId: phone.phoneNumberId,
					displayPhoneNumber: phone.displayPhoneNumber,
					verifiedName: phone.verifiedName,
					wabaId: phone.wabaId,
					whatsappUserId: account.whatsappUserId,
					whatsappAccountPublicId: account.publicId,
					accessToken: this.cryptoService.encrypt(decryptedToken),
					phoneNumberStatus: phone.phoneNumberStatus,
				},
			});

			if (!subscribedWabaIds.has(phone.wabaId)) {
				try {
					await this.waProvider.subscribeWebhook(phone.wabaId, decryptedToken);
					subscribedWabaIds.add(phone.wabaId);
				} catch (err) {
					this.logger.warn(`Failed to subscribe WABA ${phone.wabaId} to webhook: ${err}`);
				}
			}
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: WHATSAPP_AUDIT_ACTIONS.PHONES_CONNECTED,
			targetType: 'whatsapp_account',
			targetId: account.publicId,
			metadata: { connectedPhoneNumberIds: dto.phoneNumberIds },
			request,
		});

		const { rows, total, page, pageSize } = await this.channelsRepository.listChannels(
			currentUser.id,
			{ page: 1, pageSize: 50, sort: undefined, dir: undefined },
		);

		return { rows: rows.map(mapChannelResponse), total, page, pageSize };
	}

	async refreshWhatsAppToken(
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<RefreshTokenResponse> {
		const account = await this.channelsRepository.findWhatsAppAccountByUserId(currentUser.id);
		if (!account) {
			throw notFoundError('account_not_found', 'No WhatsApp account connected');
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const { accessToken: newToken, expiresAt } = await this.waProvider.refreshToken(decryptedToken);

		const encryptedToken = this.cryptoService.encrypt(newToken);
		await this.channelsRepository.updateWhatsAppAccountToken(account.id, encryptedToken, expiresAt);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: WHATSAPP_AUDIT_ACTIONS.TOKEN_REFRESHED,
			targetType: 'whatsapp_account',
			targetId: account.publicId,
			metadata: {},
			request,
		});

		return { refreshed: true };
	}
}
