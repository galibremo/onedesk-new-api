import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import { orderByColumn } from '../../core/database/helpers';
import schema from '../../core/database/schema';

import type { ChannelSchemaType } from '../../core/database/types';
import type { ChannelsListQueryDto } from './channels.schema';

export type ChannelsDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class ChannelsRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: ChannelsDatabase,
	) {}

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

	private buildListWhere(userId: number, query: ChannelsListQueryDto): SQL<unknown> {
		const conditions = [
			eq(schema.channels.userId, userId),
			isNull(schema.channels.deletedAt),
			query.search ? ilike(schema.channels.name, `%${query.search}%`) : undefined,
		].filter(Boolean) as SQL<unknown>[];

		return and(...conditions)!;
	}
}
