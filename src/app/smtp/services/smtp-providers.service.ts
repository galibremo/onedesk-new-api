import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';

import { AuditLogService } from '../../audit-log/audit-log.service';
import { badGatewayError, notFoundError } from '../../../core/errors/domain-error';
import type { SmtpProviderSchemaType } from '../../../core/database/types';
import type { UserWithoutPassword } from '../../auth/auth.types';
import { CryptoService } from '../../../core/crypto/crypto.service';
import { BrevoProvider } from '../providers/brevo.provider';
import { ResendProvider } from '../providers/resend.provider';
import { NodemailerProvider } from '../providers/nodemailer.provider';
import { AwsSesProvider } from '../providers/aws-ses.provider';
import type {
	EmailProvider,
	EmailProviderType,
	TestConnectionResult,
} from '../email-provider.interface';
import { SmtpProvidersRepository } from '../smtp-providers.repository';
import { SmtpProvidersPolicy } from '../smtp-providers.policy';
import type {
	CreateSmtpProviderDto,
	SmtpProvidersListQueryDto,
	UpdateSmtpProviderDto,
} from '../smtp-providers.schema';

@Injectable()
export class SmtpProvidersService {
	private readonly logger = new Logger(SmtpProvidersService.name);

	private readonly providers: Map<string, EmailProvider>;

	constructor(
		private readonly repository: SmtpProvidersRepository,
		private readonly cryptoService: CryptoService,
		private readonly auditLogService: AuditLogService,
	) {
		this.providers = new Map<string, EmailProvider>();
		this.providers.set('brevo', new BrevoProvider());
		this.providers.set('resend', new ResendProvider());
		this.providers.set('nodemailer', new NodemailerProvider());
		this.providers.set('aws-ses', new AwsSesProvider());
	}

	async listProviders(query: SmtpProvidersListQueryDto) {
		const result = await this.repository.findAll(query);

		return {
			rows: result.rows.map(row => this.toResponse(row)),
			total: result.total,
			page: result.page,
			pageSize: result.pageSize,
		};
	}

	async getProvider(publicId: string) {
		const provider = await this.repository.findByPublicId(publicId);
		if (!provider) {
			throw notFoundError('smtp_provider_not_found', 'SMTP provider not found');
		}

		return this.toResponse(provider);
	}

	async createProvider(
		currentUser: UserWithoutPassword,
		data: CreateSmtpProviderDto,
		request?: Request,
	) {
		const encryptedConfig = this.cryptoService.encrypt(JSON.stringify(data.config));

		const isFirst = (await this.repository.countActive()) === 0;

		const created = await this.repository.create({
			name: data.name,
			providerType: data.providerType,
			config: encryptedConfig,
			isDefault: isFirst,
			isActive: true,
		});

		if (!created) {
			throw badGatewayError('smtp_provider_create_failed', 'Failed to create SMTP provider');
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'SMTP_PROVIDER_CREATED',
			targetType: 'smtp_provider',
			targetId: created.publicId,
			metadata: { name: created.name, providerType: created.providerType },
			request,
		});

		return this.toResponse(created);
	}

	async updateProvider(
		currentUser: UserWithoutPassword,
		publicId: string,
		data: UpdateSmtpProviderDto,
		request?: Request,
	) {
		const provider = await this.getTargetProvider(publicId);

		const updateData: Partial<typeof provider> = {};

		if (data.name !== undefined) {
			updateData.name = data.name;
		}

		if (data.config !== undefined) {
			updateData.config = this.cryptoService.encrypt(JSON.stringify(data.config));
		}

		const updated = await this.repository.update(provider.id, updateData);
		if (!updated) {
			throw badGatewayError('smtp_provider_update_failed', 'Failed to update SMTP provider');
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'SMTP_PROVIDER_UPDATED',
			targetType: 'smtp_provider',
			targetId: updated.publicId,
			metadata: { name: updated.name, providerType: updated.providerType },
			request,
		});

		return this.toResponse(updated);
	}

	async deleteProvider(currentUser: UserWithoutPassword, publicId: string, request?: Request) {
		const provider = await this.getTargetProvider(publicId);
		const activeCount = await this.repository.countActive();

		SmtpProvidersPolicy.assertCanDelete(provider, activeCount);

		const deleted = await this.repository.delete(provider.id);
		if (!deleted) {
			throw badGatewayError('smtp_provider_delete_failed', 'Failed to delete SMTP provider');
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'SMTP_PROVIDER_DELETED',
			targetType: 'smtp_provider',
			targetId: deleted.publicId,
			metadata: { name: deleted.name, providerType: deleted.providerType },
			request,
		});

		return { deleted: true };
	}

	async setDefault(currentUser: UserWithoutPassword, publicId: string, request?: Request) {
		const provider = await this.getTargetProvider(publicId);

		SmtpProvidersPolicy.assertCanSetDefault(provider);

		await this.repository.clearAllDefaults(provider.id);

		const updated = await this.repository.update(provider.id, { isDefault: true });
		if (!updated) {
			throw badGatewayError(
				'smtp_provider_set_default_failed',
				'Failed to set default SMTP provider',
			);
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'SMTP_PROVIDER_SET_DEFAULT',
			targetType: 'smtp_provider',
			targetId: updated.publicId,
			metadata: { name: updated.name, providerType: updated.providerType },
			request,
		});

		return this.toResponse(updated);
	}

	async toggleProvider(currentUser: UserWithoutPassword, publicId: string, request?: Request) {
		const provider = await this.getTargetProvider(publicId);

		const updated = await this.repository.update(provider.id, { isActive: !provider.isActive });
		if (!updated) {
			throw badGatewayError('smtp_provider_toggle_failed', 'Failed to toggle SMTP provider');
		}

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'SMTP_PROVIDER_TOGGLED',
			targetType: 'smtp_provider',
			targetId: updated.publicId,
			metadata: {
				name: updated.name,
				providerType: updated.providerType,
				isActive: updated.isActive,
			},
			request,
		});

		return this.toResponse(updated);
	}

	async testConnection(
		currentUser: UserWithoutPassword,
		publicId: string,
		request?: Request,
	): Promise<TestConnectionResult> {
		const provider = await this.getTargetProvider(publicId);

		const decryptedConfig = JSON.parse(
			this.cryptoService.decrypt(provider.config),
		) as Record<string, unknown>;
		const emailProvider = this.providers.get(provider.providerType);

		if (!emailProvider) {
			const result: TestConnectionResult = {
				success: false,
				message: `Unknown provider type: ${provider.providerType}`,
			};
			await this.updateTestStatus(provider.id, 'failed');
			return result;
		}

		const result = await emailProvider.testConnection(decryptedConfig);

		await this.updateTestStatus(provider.id, result.success ? 'success' : 'failed');

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'SMTP_PROVIDER_TESTED',
			targetType: 'smtp_provider',
			targetId: provider.publicId,
			metadata: {
				name: provider.name,
				providerType: provider.providerType,
				success: result.success,
			},
			request,
		});

		return result;
	}

	async getAllActiveProviders(): Promise<SmtpProviderSchemaType[]> {
		return this.repository.findAllActive();
	}

	private async getTargetProvider(publicId: string): Promise<SmtpProviderSchemaType> {
		const provider = await this.repository.findByPublicId(publicId);
		if (!provider) {
			throw notFoundError('smtp_provider_not_found', 'SMTP provider not found');
		}
		return provider;
	}

	private async updateTestStatus(id: number, status: 'success' | 'failed'): Promise<void> {
		await this.repository.updateTestStatus(id, status, new Date());
	}

	private toResponse(provider: SmtpProviderSchemaType) {
		const decryptedConfig = JSON.parse(
			this.cryptoService.decrypt(provider.config),
		) as Record<string, unknown>;

		return {
			id: provider.publicId,
			name: provider.name,
			providerType: provider.providerType as EmailProviderType,
			config: this.maskConfig(decryptedConfig),
			isDefault: provider.isDefault,
			isActive: provider.isActive,
			lastTestedAt: provider.lastTestedAt?.toISOString() ?? null,
			lastTestStatus: provider.lastTestStatus ?? null,
			createdAt: provider.createdAt.toISOString(),
			updatedAt: provider.updatedAt.toISOString(),
		};
	}

	private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
		const masked = { ...config };
		const sensitiveFields = ['apiKey', 'secretAccessKey', 'pass'];

		for (const field of sensitiveFields) {
			if (field in masked) {
				masked[field] = '••••••••';
			}
		}

		if (
			masked.auth &&
			typeof masked.auth === 'object' &&
			'pass' in (masked.auth as Record<string, unknown>)
		) {
			masked.auth = {
				...(masked.auth as Record<string, unknown>),
				pass: '••••••••',
			};
		}

		return masked;
	}
}
