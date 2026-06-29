import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../../core/database/connection';
import schema from '../../../core/database/schema';
import type { ChannelSchemaType, InstagramAccountSchemaType } from '../../../core/database/types';
import type { InstagramChannelConfig } from '../interfaces/config.interface';
import type { ChannelsDatabase } from '../channels.repository';

@Injectable()
export class InstagramRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: ChannelsDatabase,
	) {}

	async upsertChannel(data: {
		userId: number;
		name: string;
		config: InstagramChannelConfig;
	}): Promise<ChannelSchemaType> {
		const result = await this.db
			.insert(schema.channels)
			.values({
				name: data.name,
				channelType: 'instagram',
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
				and(eq(schema.channels.userId, data.userId), eq(schema.channels.channelType, 'instagram')),
			)
			.returning();

		return updated[0];
	}

	findAccountByUserId(userId: number): Promise<InstagramAccountSchemaType | undefined> {
		return this.db.query.instagramAccounts.findFirst({
			where: eq(schema.instagramAccounts.userId, userId),
		});
	}

	findAccountByPublicId(
		publicId: string,
		userId: number,
	): Promise<InstagramAccountSchemaType | undefined> {
		return this.db.query.instagramAccounts.findFirst({
			where: and(
				eq(schema.instagramAccounts.publicId, publicId),
				eq(schema.instagramAccounts.userId, userId),
			),
		});
	}

	async upsertAccount(data: {
		userId: number;
		instagramUserId: string;
		accessToken: string;
		tokenExpiration: Date | null;
	}): Promise<InstagramAccountSchemaType> {
		const result = await this.db
			.insert(schema.instagramAccounts)
			.values(data)
			.onConflictDoUpdate({
				target: [schema.instagramAccounts.userId, schema.instagramAccounts.instagramUserId],
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
			.update(schema.instagramAccounts)
			.set({ accessToken, tokenExpiration, updatedAt: new Date() })
			.where(eq(schema.instagramAccounts.id, accountId));
	}
}
