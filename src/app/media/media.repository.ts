import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import { orderByColumn } from '../../core/database/helpers';
import schema from '../../core/database/schema';
import type { MediaSchemaType } from '../../core/database/types';
import type { MediaDataType } from './media.types';
import { type MediaDto, type MediaListQueryDto } from './media.schema';
import type { MediaDeleteRow, MediaResponseRow } from './media.mapper';

export type MediaDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class MediaRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: MediaDatabase,
	) {}

	async create(data: MediaDataType): Promise<MediaSchemaType | null> {
		return this.db
			.insert(schema.media)
			.values(data)
			.returning()
			.then(rows => rows[0] || null);
	}

	listByUserId(userId: number): Promise<MediaResponseRow[]> {
		return this.db
			.select(this.mediaResponseSelection())
			.from(schema.media)
			.where(eq(schema.media.uploadedBy, userId))
			.orderBy(schema.media.createdAt);
	}

	async listByUserIdPaginated(
		userId: number,
		query: MediaListQueryDto,
	): Promise<{ rows: MediaResponseRow[]; total: number }> {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;

		const conditions = [eq(schema.media.uploadedBy, userId)] as SQL<unknown>[];

		if (query.search) {
			conditions.push(
				or(
					ilike(schema.media.filename, `%${query.search}%`),
					ilike(schema.media.altText, `%${query.search}%`),
				)!,
			);
		}

		if (query.mediaType) {
			conditions.push(eq(schema.media.mediaType, query.mediaType));
		}

		if (query.fromDate) {
			conditions.push(gte(schema.media.createdAt, new Date(query.fromDate)));
		}

		if (query.toDate) {
			const toDate = new Date(query.toDate);
			toDate.setHours(23, 59, 59, 999);
			conditions.push(lte(schema.media.createdAt, toDate));
		}

		const whereClause = and(...conditions);
		const orderBy =
			orderByColumn(schema.media, query.sort, query.dir) ?? desc(schema.media.createdAt);

		const [rows, totalRows] = await Promise.all([
			this.db
				.select(this.mediaResponseSelection())
				.from(schema.media)
				.where(whereClause)
				.orderBy(orderBy)
				.limit(pageSize)
				.offset(offset),
			this.db.select({ value: count() }).from(schema.media).where(whereClause),
		]);

		return {
			rows,
			total: Number(totalRows[0]?.value ?? 0),
		};
	}

	async findByPublicIdForUser(userId: number, publicId: string): Promise<MediaResponseRow | null> {
		return this.db
			.select(this.mediaResponseSelection())
			.from(schema.media)
			.where(and(eq(schema.media.publicId, publicId), eq(schema.media.uploadedBy, userId)))
			.then(rows => rows[0] || null);
	}

	async updateForUser(
		userId: number,
		publicId: string,
		data: MediaDto,
	): Promise<MediaSchemaType | null> {
		return this.db
			.update(schema.media)
			.set({
				altText: data.altText,
				filename: data.name,
			})
			.where(and(eq(schema.media.publicId, publicId), eq(schema.media.uploadedBy, userId)))
			.returning()
			.then(rows => rows[0] || null);
	}

	async deleteForUser(userId: number, publicId: string): Promise<MediaDeleteRow | null> {
		return this.db
			.delete(schema.media)
			.where(and(eq(schema.media.publicId, publicId), eq(schema.media.uploadedBy, userId)))
			.returning(this.mediaDeleteSelection())
			.then(rows => rows[0] || null);
	}

	async countByUserId(userId: number): Promise<number> {
		return this.db
			.select({ id: schema.media.id })
			.from(schema.media)
			.where(eq(schema.media.uploadedBy, userId))
			.then(rows => rows.length);
	}

	private mediaResponseSelection() {
		return {
			publicId: schema.media.publicId,
			filename: schema.media.filename,
			mimeType: schema.media.mimeType,
			fileSize: schema.media.fileSize,
			secureUrl: schema.media.secureUrl,
			mediaType: schema.media.mediaType,
			altText: schema.media.altText,
			width: schema.media.width,
			height: schema.media.height,
			tags: schema.media.tags,
			createdAt: schema.media.createdAt,
			updatedAt: schema.media.updatedAt,
		};
	}

	private mediaDeleteSelection() {
		return {
			...this.mediaResponseSelection(),
			storageKey: schema.media.storageKey,
		};
	}
}
