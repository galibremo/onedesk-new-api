import { forbiddenError } from '../../core/errors/domain-error';
import type { SmtpProviderSchemaType } from '../../core/database/types';

export class SmtpProvidersPolicy {
	static assertCanDelete(provider: SmtpProviderSchemaType, activeCount: number): void {
		if (!provider.isActive && activeCount === 0) {
			return;
		}

		if (activeCount <= 1 && provider.isActive) {
			throw forbiddenError(
				'cannot_delete_last_active_provider',
				'Cannot delete the only active SMTP provider. Deactivate it first or add another provider.',
			);
		}
	}

	static assertCanSetDefault(provider: SmtpProviderSchemaType): void {
		if (!provider.isActive) {
			throw forbiddenError(
				'cannot_set_inactive_default',
				'Cannot set an inactive provider as default. Activate it first.',
			);
		}
	}
}
