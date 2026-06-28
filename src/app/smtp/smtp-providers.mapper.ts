import type { SmtpProviderSchemaType } from '../../core/database/types';
import type { EmailProviderType } from './email-provider.interface';
import type { SmtpProviderResponse } from './smtp.types';

const SENSITIVE_FIELDS = ['apiKey', 'secretAccessKey', 'pass'] as const;
const MASKED_VALUE = '••••••••';

export function mapToResponse(provider: SmtpProviderSchemaType): SmtpProviderResponse {
	const config: Record<string, unknown> =
		typeof provider.config === 'string'
			? (JSON.parse(provider.config) as Record<string, unknown>)
			: (provider.config);

	return {
		id: provider.publicId,
		name: provider.name,
		providerType: provider.providerType as EmailProviderType,
		config: maskConfig(config),
		isDefault: provider.isDefault,
		isActive: provider.isActive,
		lastTestedAt: provider.lastTestedAt?.toISOString() ?? null,
		lastTestStatus: provider.lastTestStatus ?? null,
		createdAt: provider.createdAt.toISOString(),
		updatedAt: provider.updatedAt.toISOString(),
	};
}

export function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
	const masked = { ...config };

	for (const field of SENSITIVE_FIELDS) {
		if (field in masked) {
			masked[field] = MASKED_VALUE;
		}
	}

	// Handle nested auth.pass for nodemailer
	if (
		masked.auth &&
		typeof masked.auth === 'object' &&
		'pass' in (masked.auth as Record<string, unknown>)
	) {
		masked.auth = {
			...(masked.auth as Record<string, unknown>),
			pass: MASKED_VALUE,
		};
	}

	return masked;
}
