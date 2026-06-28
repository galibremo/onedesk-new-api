import { Injectable, type OnModuleInit } from '@nestjs/common';
import { SystemRepository } from './system.repository';
import type { SystemSettingsSchemaType } from '../../core/database/types';

@Injectable()
export class SystemService implements OnModuleInit {
	private cachedSettings: SystemSettingsSchemaType | null = null;
	private cacheExpiresAt = 0;
	private readonly CACHE_TTL_MS = 60 * 1000;

	constructor(private readonly systemRepository: SystemRepository) {}

	async onModuleInit() {
		try {
			await this.systemRepository.initializeSchema();
		} catch (error) {
			console.error('Failed to initialize database system schema:', error);
		}

		const settings = await this.systemRepository.getSettings();
		if (!settings) {
			await this.systemRepository.createSettings({
				accessModel: 'OPEN',
				allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
			});
		}
	}

	async getSettings(): Promise<SystemSettingsSchemaType> {
		if (this.cachedSettings && Date.now() < this.cacheExpiresAt) {
			return this.cachedSettings;
		}

		const settings = await this.systemRepository.getSettings();
		if (!settings) {
			return this.cacheSettings(
				await this.systemRepository.createSettings({
					accessModel: 'OPEN',
					allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
				}),
			);
		}

		return this.cacheSettings(settings);
	}

	async updateSettings(data: {
		accessModel?: 'OPEN' | 'APPROVAL_BASED' | 'CLOSED';
		allowedRoles?: string[];
	}): Promise<SystemSettingsSchemaType> {
		const settings = await this.getSettings();
		const updatedSettings = await this.systemRepository.updateSettings(settings.id, data);

		this.invalidateSettingsCache();

		return updatedSettings;
	}

	private cacheSettings(settings: SystemSettingsSchemaType): SystemSettingsSchemaType {
		this.cachedSettings = settings;
		this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;

		return settings;
	}

	private invalidateSettingsCache(): void {
		this.cachedSettings = null;
		this.cacheExpiresAt = 0;
	}
}
