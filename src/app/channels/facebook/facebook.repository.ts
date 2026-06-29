import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../../core/database/connection';
import schema from '../../../core/database/schema';
import type { ChannelSchemaType, FacebookAccountSchemaType } from '../../../core/database/types';
import type { ChannelsDatabase } from '../channels.repository';
import { FacebookChannelConfig } from './interfaces/facebook.interface';

@Injectable()
export class FacebookRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: ChannelsDatabase,
	) {}

	async upsertChannel(data: {
		userId: number;
		name: string;
		config: FacebookChannelConfig;
	}): Promise<ChannelSchemaType> {
		const result = await this.db
			.insert(schema.channels)
			.values({
				name: data.name,
				channelType: 'facebook',
				status: 'active',
				channelConfig: data.config,
				userId: data.userId,
			})
			.onConflictDoNothing()
			.returning();

		if (result[0]) return result[0];

		const updated = await this.db
			.update(schema.channels)
			.set({
				name: data.name,
				channelConfig: data.config,
				status: 'active',
				deletedAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(eq(schema.channels.userId, data.userId), eq(schema.channels.channelType, 'facebook')),
			)
			.returning();

		return updated[0];
	}

	async upsertChannelsByPageId(
		userId: number,
		pages: Array<{ name: string; config: FacebookChannelConfig }>,
	): Promise<void> {
		if (pages.length === 0) return;

		for (const page of pages) {
			await this.db
				.insert(schema.channels)
				.values({
					name: page.name,
					channelType: 'facebook',
					status: 'active',
					channelConfig: page.config,
					userId,
				})
				.onConflictDoNothing();
		}
	}

	async activateChannels(
		userId: number,
		selectedConfigs: Array<{ name: string; config: FacebookChannelConfig }>,
	): Promise<ChannelSchemaType[]> {
		const inserted: ChannelSchemaType[] = [];

		for (const item of selectedConfigs) {
			const rows = await this.db
				.insert(schema.channels)
				.values({
					name: item.name,
					channelType: 'facebook',
					status: 'active',
					channelConfig: item.config,
					userId,
				})
				.onConflictDoNothing()
				.returning();

			if (rows[0]) {
				inserted.push(rows[0]);
			}
		}

		return inserted;
	}

	findAccountByUserId(userId: number): Promise<FacebookAccountSchemaType | undefined> {
		return this.db.query.facebookAccounts.findFirst({
			where: eq(schema.facebookAccounts.userId, userId),
		});
	}

	findAccountByPublicId(
		publicId: string,
		userId: number,
	): Promise<FacebookAccountSchemaType | undefined> {
		return this.db.query.facebookAccounts.findFirst({
			where: and(
				eq(schema.facebookAccounts.publicId, publicId),
				eq(schema.facebookAccounts.userId, userId),
			),
		});
	}

	async upsertAccount(data: {
		userId: number;
		facebookUserId: string;
		accessToken: string;
		tokenExpiration: Date | null;
	}): Promise<FacebookAccountSchemaType> {
		const result = await this.db
			.insert(schema.facebookAccounts)
			.values(data)
			.onConflictDoUpdate({
				target: [schema.facebookAccounts.userId, schema.facebookAccounts.facebookUserId],
				set: {
					accessToken: data.accessToken,
					tokenExpiration: data.tokenExpiration,
					updatedAt: new Date(),
				},
			})
			.returning();
		return result[0];
	}

	async updateAccountToken(
		accountId: number,
		accessToken: string,
		tokenExpiration: Date | null,
	): Promise<void> {
		await this.db
			.update(schema.facebookAccounts)
			.set({ accessToken, tokenExpiration, updatedAt: new Date() })
			.where(eq(schema.facebookAccounts.id, accountId));
	}
}
