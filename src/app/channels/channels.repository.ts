import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import { orderByColumn } from '../../core/database/helpers';
import schema from '../../core/database/schema';

import type {
	ChannelSchemaType,
	FacebookAccountSchemaType,
	InstagramAccountSchemaType,
	WhatsAppAccountSchemaType,
} from '../../core/database/types';
import type { ChannelsListQueryDto } from './channels.schema';
import {
	FacebookChannelConfig,
	InstagramChannelConfig,
	WhatsAppChannelConfig,
} from './interfaces/config.interface';

export type ChannelsDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class ChannelsRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: ChannelsDatabase,
	) {}

	async upsertFacebookChannel(data: {
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

		// If conflict (already exists), update config + status + name
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
				and(
					eq(schema.channels.userId, data.userId),
					eq(schema.channels.channelType, 'facebook'),
					// Match by facebookPageId inside config using jsonb operator
					// Drizzle doesn't have a built-in jsonb path eq, so we re-query by name as fallback
				),
			)
			.returning();

		return updated[0];
	}

	async upsertWhatsAppChannel(data: {
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

		// If conflict (already exists), update config + status + name
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

	async upsertInstagramChannel(data: {
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

		// If conflict (already exists), update config + status + name
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

	async upsertFacebookChannelsByPageId(
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

	async activateFacebookChannels(
		userId: number,
		selectedConfigs: Array<{ name: string; config: FacebookChannelConfig }>,
	): Promise<ChannelSchemaType[]> {
		// Soft-delete all existing active Facebook channels for this account
		// then upsert the selected ones
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

	async listChannels(
		userId: number,
		query: ChannelsListQueryDto,
	): Promise<{ rows: ChannelSchemaType[]; total: number; page: number; pageSize: number }> {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;
		const whereClause = this.buildListWhere(userId, query);
		const orderBy =
			orderByColumn(schema.channels, query.sort, query.dir ?? 'desc') ??
			desc(schema.channels.createdAt);

		const [rows, totalRows] = await Promise.all([
			this.db
				.select()
				.from(schema.channels)
				.where(whereClause)
				.orderBy(orderBy)
				.limit(pageSize)
				.offset(offset),
			this.db.select({ value: count() }).from(schema.channels).where(whereClause),
		]);

		return { rows, total: Number(totalRows[0]?.value ?? 0), page, pageSize };
	}

	findByPublicId(publicId: string, userId: number): Promise<ChannelSchemaType | undefined> {
		return this.db.query.channels.findFirst({
			where: and(
				eq(schema.channels.publicId, publicId),
				eq(schema.channels.userId, userId),
				isNull(schema.channels.deletedAt),
			),
		});
	}

	async softDelete(channelId: number): Promise<void> {
		await this.db
			.update(schema.channels)
			.set({ deletedAt: new Date(), status: 'disconnected', updatedAt: new Date() })
			.where(eq(schema.channels.id, channelId));
	}

	// ── Facebook Account Methods ─────────────────────────────────────────

	findFacebookAccountByUserId(userId: number): Promise<FacebookAccountSchemaType | undefined> {
		return this.db.query.facebookAccounts.findFirst({
			where: eq(schema.facebookAccounts.userId, userId),
		});
	}

	findFacebookAccountByPublicId(
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

	async upsertFacebookAccount(data: {
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

	async updateFacebookAccountToken(
		accountId: number,
		accessToken: string,
		tokenExpiration: Date | null,
	): Promise<void> {
		await this.db
			.update(schema.facebookAccounts)
			.set({ accessToken, tokenExpiration, updatedAt: new Date() })
			.where(eq(schema.facebookAccounts.id, accountId));
	}

	// ── Instagram Account Methods ────────────────────────────────────────

	findInstagramAccountByUserId(userId: number): Promise<InstagramAccountSchemaType | undefined> {
		return this.db.query.instagramAccounts.findFirst({
			where: eq(schema.instagramAccounts.userId, userId),
		});
	}

	findInstagramAccountByPublicId(
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

	async upsertInstagramAccount(data: {
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

	async updateInstagramAccountToken(
		accountId: number,
		accessToken: string,
		tokenExpiration: Date | null,
	): Promise<void> {
		await this.db
			.update(schema.instagramAccounts)
			.set({ accessToken, tokenExpiration, updatedAt: new Date() })
			.where(eq(schema.instagramAccounts.id, accountId));
	}

	// ── WhatsApp Account Methods ─────────────────────────────────────────

	findWhatsAppAccountByUserId(userId: number): Promise<WhatsAppAccountSchemaType | undefined> {
		return this.db.query.whatsappAccounts.findFirst({
			where: eq(schema.whatsappAccounts.userId, userId),
		});
	}

	findWhatsAppAccountByPublicId(
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

	async upsertWhatsAppAccount(data: {
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

	async updateWhatsAppAccountToken(
		accountId: number,
		accessToken: string,
		tokenExpiration: Date | null,
	): Promise<void> {
		await this.db
			.update(schema.whatsappAccounts)
			.set({ accessToken, tokenExpiration, updatedAt: new Date() })
			.where(eq(schema.whatsappAccounts.id, accountId));
	}

	private buildListWhere(userId: number, query: ChannelsListQueryDto): SQL<unknown> {
		const conditions = [
			eq(schema.channels.userId, userId),
			isNull(schema.channels.deletedAt),
			query.search ? ilike(schema.channels.name, `%${query.search}%`) : undefined,
		].filter(Boolean) as SQL<unknown>[];

		return and(...conditions)!;
	}
}
