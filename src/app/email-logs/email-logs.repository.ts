import { Inject, Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import { orderByColumn } from '../../core/database/helpers';
import schema from '../../core/database/schema';
import type { EmailLogSchemaType } from '../../core/database/types';
import type { EmailLogsListQueryDto } from './email-logs.schema';

export type EmailLogDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class EmailLogsRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: EmailLogDatabase,
	) {}

	async create(
		data: typeof schema.emailLogs.$inferInsert,
	): Promise<EmailLogSchemaType | undefined> {
		return this.db
			.insert(schema.emailLogs)
			.values(data)
			.returning()
			.then(rows => rows[0]);
	}

	async findByProviderId(
		providerId: number,
		query: EmailLogsListQueryDto,
	): Promise<{
		rows: EmailLogSchemaType[];
		total: number;
		page: number;
		pageSize: number;
	}> {
		const whereClause = this.getWhereClause(providerId, query);
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;
		const orderBy = orderByColumn(schema.emailLogs, query.sort, query.dir ?? 'desc');

		const [rows, totalRows] = await Promise.all([
			this.db
				.select()
				.from(schema.emailLogs)
				.where(whereClause)
				.orderBy(orderBy ?? desc(schema.emailLogs.createdAt))
				.limit(pageSize)
				.offset(offset),
			this.db.select({ value: count() }).from(schema.emailLogs).where(whereClause),
		]);

		return {
			rows,
			total: Number(totalRows[0]?.value ?? 0),
			page,
			pageSize,
		};
	}

	async findAll(query: EmailLogsListQueryDto): Promise<{
		rows: EmailLogSchemaType[];
		total: number;
		page: number;
		pageSize: number;
	}> {
		const whereClause = this.getWhereClause(undefined, query);
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;
		const orderBy = orderByColumn(schema.emailLogs, query.sort, query.dir ?? 'desc');

		const [rows, totalRows] = await Promise.all([
			this.db
				.select()
				.from(schema.emailLogs)
				.where(whereClause)
				.orderBy(orderBy ?? desc(schema.emailLogs.createdAt))
				.limit(pageSize)
				.offset(offset),
			this.db.select({ value: count() }).from(schema.emailLogs).where(whereClause),
		]);

		return {
			rows,
			total: Number(totalRows[0]?.value ?? 0),
			page,
			pageSize,
		};
	}

	async findByPublicId(publicId: string): Promise<EmailLogSchemaType | undefined> {
		return this.db.query.emailLogs.findFirst({
			where: eq(schema.emailLogs.publicId, publicId),
		});
	}

	async findByPublicIdAndProviderId(
		publicId: string,
		providerId: number,
	): Promise<EmailLogSchemaType | undefined> {
		return this.db.query.emailLogs.findFirst({
			where: and(
				eq(schema.emailLogs.publicId, publicId),
				eq(schema.emailLogs.smtpProviderId, providerId),
			),
		});
	}

	async deleteByPublicIdAndProviderId(
		publicId: string,
		providerId: number,
	): Promise<EmailLogSchemaType | undefined> {
		return this.db
			.delete(schema.emailLogs)
			.where(
				and(
					eq(schema.emailLogs.publicId, publicId),
					eq(schema.emailLogs.smtpProviderId, providerId),
				),
			)
			.returning()
			.then(rows => rows[0]);
	}

	private getWhereClause(
		providerId: number | undefined,
		query: EmailLogsListQueryDto,
	): SQL<unknown> | undefined {
		const conditions: (SQL<unknown> | undefined)[] = [];

		if (providerId !== undefined) {
			conditions.push(eq(schema.emailLogs.smtpProviderId, providerId));
		}

		if (query.toEmail) {
			conditions.push(eq(schema.emailLogs.toEmail, query.toEmail));
		}

		if (query.status) {
			conditions.push(eq(schema.emailLogs.status, query.status));
		}

		if (query.templateKey) {
			conditions.push(eq(schema.emailLogs.templateKey, query.templateKey));
		}

		if (query.fromDate) {
			conditions.push(gte(schema.emailLogs.createdAt, new Date(query.fromDate)));
		}

		if (query.toDate) {
			const toDate = new Date(query.toDate);
			toDate.setHours(23, 59, 59, 999);
			conditions.push(lte(schema.emailLogs.createdAt, toDate));
		}

		const filtered = conditions.filter(Boolean) as SQL<unknown>[];
		return filtered.length > 0 ? and(...filtered) : undefined;
	}
}
