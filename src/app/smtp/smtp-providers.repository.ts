import { Inject, Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import { orderByColumn } from '../../core/database/helpers';
import schema from '../../core/database/schema';
import type { SmtpProviderSchemaType } from '../../core/database/types';
import type { SmtpProvidersListQueryDto } from './smtp-providers.schema';

export type SmtpProvidersDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class SmtpProvidersRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: SmtpProvidersDatabase,
	) {}

	async findAll(query: SmtpProvidersListQueryDto): Promise<{
		rows: SmtpProviderSchemaType[];
		total: number;
		page: number;
		pageSize: number;
	}> {
		const whereClause = this.getWhereClause(query);
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;
		const orderBy = orderByColumn(schema.smtpProviders, query.sort, query.dir ?? 'desc');

		const [rows, totalRows] = await Promise.all([
			this.db
				.select()
				.from(schema.smtpProviders)
				.where(whereClause)
				.orderBy(orderBy ?? desc(schema.smtpProviders.createdAt))
				.limit(pageSize)
				.offset(offset),
			this.db.select({ value: count() }).from(schema.smtpProviders).where(whereClause),
		]);

		return {
			rows,
			total: Number(totalRows[0]?.value ?? 0),
			page,
			pageSize,
		};
	}

	async findByPublicId(publicId: string): Promise<SmtpProviderSchemaType | undefined> {
		return this.db.query.smtpProviders.findFirst({
			where: eq(schema.smtpProviders.publicId, publicId),
		});
	}

	async findDefaultActive(): Promise<SmtpProviderSchemaType | undefined> {
		return this.db.query.smtpProviders.findFirst({
			where: and(eq(schema.smtpProviders.isDefault, true), eq(schema.smtpProviders.isActive, true)),
		});
	}

	async findAllActive(): Promise<SmtpProviderSchemaType[]> {
		return this.db
			.select()
			.from(schema.smtpProviders)
			.where(eq(schema.smtpProviders.isActive, true))
			.orderBy(desc(schema.smtpProviders.isDefault), asc(schema.smtpProviders.createdAt));
	}

	async create(
		data: typeof schema.smtpProviders.$inferInsert,
	): Promise<SmtpProviderSchemaType | undefined> {
		return this.db
			.insert(schema.smtpProviders)
			.values(data)
			.returning()
			.then(rows => rows[0]);
	}

	async update(
		id: number,
		data: Partial<typeof schema.smtpProviders.$inferInsert>,
	): Promise<SmtpProviderSchemaType | undefined> {
		return this.db
			.update(schema.smtpProviders)
			.set(data)
			.where(eq(schema.smtpProviders.id, id))
			.returning()
			.then(rows => rows[0]);
	}

	async delete(id: number): Promise<SmtpProviderSchemaType | undefined> {
		return this.db
			.delete(schema.smtpProviders)
			.where(eq(schema.smtpProviders.id, id))
			.returning()
			.then(rows => rows[0]);
	}

	async clearAllDefaults(exceptId?: number): Promise<void> {
		if (exceptId) {
			await this.db
				.update(schema.smtpProviders)
				.set({ isDefault: false })
				.where(
					and(eq(schema.smtpProviders.isDefault, true), eq(schema.smtpProviders.id, exceptId)),
				);
		} else {
			await this.db
				.update(schema.smtpProviders)
				.set({ isDefault: false })
				.where(eq(schema.smtpProviders.isDefault, true));
		}
	}

	async updateTestStatus(
		id: number,
		status: 'success' | 'failed',
		testedAt: Date,
	): Promise<SmtpProviderSchemaType | undefined> {
		return this.db
			.update(schema.smtpProviders)
			.set({ lastTestStatus: status, lastTestedAt: testedAt })
			.where(eq(schema.smtpProviders.id, id))
			.returning()
			.then(rows => rows[0]);
	}

	async countActive(): Promise<number> {
		const result = await this.db
			.select({ value: count() })
			.from(schema.smtpProviders)
			.where(eq(schema.smtpProviders.isActive, true));

		return Number(result[0]?.value ?? 0);
	}

	private getWhereClause(query: SmtpProvidersListQueryDto): SQL<unknown> | undefined {
		const conditions: (SQL<unknown> | undefined)[] = [];

		if (query.search) {
			const q = `%${query.search}%`;
			conditions.push(
				or(ilike(schema.smtpProviders.name, q), ilike(schema.smtpProviders.providerType, q)),
			);
		}

		if (query.providerType) {
			conditions.push(eq(schema.smtpProviders.providerType, query.providerType));
		}

		if (typeof query.isActive === 'boolean') {
			conditions.push(eq(schema.smtpProviders.isActive, query.isActive));
		}

		if (query.fromDate) {
			conditions.push(gte(schema.smtpProviders.createdAt, new Date(query.fromDate)));
		}

		if (query.toDate) {
			const toDate = new Date(query.toDate);
			toDate.setHours(23, 59, 59, 999);
			conditions.push(lte(schema.smtpProviders.createdAt, toDate));
		}

		const filtered = conditions.filter(Boolean) as SQL<unknown>[];
		return filtered.length > 0 ? and(...filtered) : undefined;
	}
}
