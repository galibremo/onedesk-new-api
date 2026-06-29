import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../../core/database/connection';
import schema from '../../../core/database/schema';
import type { ChannelSchemaType, WhatsAppAccountSchemaType } from '../../../core/database/types';
import type { WhatsAppChannelConfig } from '../interfaces/config.interface';
import type { ChannelsDatabase } from '../channels.repository';

@Injectable()
export class WhatsAppRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: ChannelsDatabase,
	) {}

	async upsertChannel(data: {
		userId: number;
		name: string;
		config: WhatsAppChannelConfig;
	}): Promise<ChannelSchemaType> {
		const result = await this.db
			.insert(schema.channels)
			.values({
				name: data.name,
				channelType: 'whatsapp',
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
				and(eq(schema.channels.userId, data.userId), eq(schema.channels.channelType, 'whatsapp')),
			)
			.returning();

		return updated[0];
	}

	findAccountByUserId(userId: number): Promise<WhatsAppAccountSchemaType | undefined> {
		return this.db.query.whatsappAccounts.findFirst({
			where: eq(schema.whatsappAccounts.userId, userId),
		});
	}

	findAccountByPublicId(
		publicId: string,
		userId: number,
	): Promise<WhatsAppAccountSchemaType | undefined> {
		return this.db.query.whatsappAccounts.findFirst({
			where: and(
				eq(schema.whatsappAccounts.publicId, publicId),
				eq(schema.whatsappAccounts.userId, userId),
			),
		});
	}

	async upsertAccount(data: {
		userId: number;
		whatsappUserId: string;
		accessToken: string;
		tokenExpiration: Date | null;
	}): Promise<WhatsAppAccountSchemaType> {
		const result = await this.db
			.insert(schema.whatsappAccounts)
			.values(data)
			.onConflictDoUpdate({
				target: [schema.whatsappAccounts.userId, schema.whatsappAccounts.whatsappUserId],
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
			.update(schema.whatsappAccounts)
			.set({ accessToken, tokenExpiration, updatedAt: new Date() })
			.where(eq(schema.whatsappAccounts.id, accountId));
	}
}
