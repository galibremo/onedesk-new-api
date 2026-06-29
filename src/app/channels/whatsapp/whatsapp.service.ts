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
import type { OAuthCallbackDto, WhatsappConnectPhonesDto } from '../channels.schema';
import type { ChannelsListResponse, OAuthUrlResponse, RefreshTokenResponse } from '../channels.types';
import type { WhatsAppProviderInterface } from './interfaces/whatsapp-provider.interface';
import { WHATSAPP_AUDIT_ACTIONS, SOCIAL_PROVIDER_WHATSAPP } from './constants/whatsapp.constants';
import type { WhatsAppCallbackResponse } from './whatsapp.types';
import { WhatsAppRepository } from './whatsapp.repository';

@Injectable()
export class WhatsAppService {
	private readonly logger = new Logger(WhatsAppService.name);

	constructor(
		@Inject(SOCIAL_PROVIDER_WHATSAPP)
		private readonly waProvider: WhatsAppProviderInterface,
		private readonly whatsappRepository: WhatsAppRepository,
		private readonly cryptoService: CryptoService,
		private readonly jwtService: JwtService,
		private readonly auditLogService: AuditLogService,
		private readonly configService: ConfigService<EnvType, true>,
	) {}

	async generateOAuthUrl(userId: number): Promise<OAuthUrlResponse> {
		const { url } = await this.waProvider.authenticate(userId);
		return { url };
	}

	async handleOAuthCallback(
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
		const account = await this.whatsappRepository.upsertAccount({
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

		const phoneResponses: WhatsAppCallbackResponse['phoneNumbers'] = phoneNumbers.map(p => ({
			phoneNumberId: p.phoneNumberId,
			displayPhoneNumber: p.displayPhoneNumber,
			verifiedName: p.verifiedName,
			wabaId: p.wabaId,
			phoneNumberStatus: p.phoneNumberStatus,
		}));

		return { accountId: account.publicId, phoneNumbers: phoneResponses };
	}

	async connectPhones(
		dto: WhatsappConnectPhonesDto,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<ChannelsListResponse> {
		const account = await this.whatsappRepository.findAccountByPublicId(
			dto.whatsappAccountPublicId,
			currentUser.id,
		);
		if (!account) {
			throw new DomainError('account_not_found', 'WhatsApp account not found', HttpStatus.NOT_FOUND);
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const allPhones = await this.waProvider.getPhoneNumbers(decryptedToken);
		const selectedPhones = allPhones.filter(p => dto.phoneNumberIds.includes(p.phoneNumberId));

		const subscribedWabaIds = new Set<string>();

		for (const phone of selectedPhones) {
			await this.whatsappRepository.upsertChannel({
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

		return { rows: [], total: 0, page: 1, pageSize: 50 };
	}

	async refreshToken(
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<RefreshTokenResponse> {
		const account = await this.whatsappRepository.findAccountByUserId(currentUser.id);
		if (!account) {
			throw new DomainError('account_not_found', 'No WhatsApp account connected', HttpStatus.NOT_FOUND);
		}

		const decryptedToken = this.cryptoService.decrypt(account.accessToken);
		const { accessToken: newToken, expiresAt } = await this.waProvider.refreshToken(decryptedToken);

		const encryptedToken = this.cryptoService.encrypt(newToken);
		await this.whatsappRepository.updateAccountToken(account.id, encryptedToken, expiresAt);

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
