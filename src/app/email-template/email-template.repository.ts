import { Inject, Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import { orderByColumn } from '../../core/database/helpers';
import schema from '../../core/database/schema';
import type { EmailTemplateSchemaType } from '../../core/database/types';
import type { EmailTemplateListQueryDto } from './schemas/email-template-list.schema';

export type EmailTemplateDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class EmailTemplateRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: EmailTemplateDatabase,
	) {}

	async findActiveByKey(templateKey: string): Promise<EmailTemplateSchemaType | null> {
		return this.db
			.select()
			.from(schema.emailTemplates)
			.where(
				and(eq(schema.emailTemplates.key, templateKey), eq(schema.emailTemplates.isActive, true)),
			)
			.orderBy(desc(schema.emailTemplates.version))
			.limit(1)
			.then(rows => rows[0] ?? null);
	}

	async findAllActive(): Promise<EmailTemplateSchemaType[]> {
		return this.db
			.select()
			.from(schema.emailTemplates)
			.where(eq(schema.emailTemplates.isActive, true))
			.orderBy(desc(schema.emailTemplates.version));
	}

	async findAll(query: EmailTemplateListQueryDto): Promise<{
		rows: EmailTemplateSchemaType[];
		total: number;
		page: number;
		pageSize: number;
	}> {
		const whereClause = this.getWhereClause(query);
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;
		const orderBy = orderByColumn(schema.emailTemplates, query.sort, query.dir ?? 'desc');

		const [rows, totalRows] = await Promise.all([
			this.db
				.select()
				.from(schema.emailTemplates)
				.where(whereClause)
				.orderBy(orderBy ?? desc(schema.emailTemplates.version))
				.limit(pageSize)
				.offset(offset),
			this.db.select({ value: count() }).from(schema.emailTemplates).where(whereClause),
		]);

		return {
			rows,
			total: Number(totalRows[0]?.value ?? 0),
			page,
			pageSize,
		};
	}

	async findByPublicId(publicId: string): Promise<EmailTemplateSchemaType | null> {
		return this.db
			.select()
			.from(schema.emailTemplates)
			.where(eq(schema.emailTemplates.publicId, publicId))
			.then(rows => rows[0] ?? null);
	}

	async findById(id: number): Promise<EmailTemplateSchemaType | null> {
		return this.db
			.select()
			.from(schema.emailTemplates)
			.where(eq(schema.emailTemplates.id, id))
			.then(rows => rows[0] ?? null);
	}

	async create(template: {
		key: string;
		subject: string;
		html: string;
		text?: string;
		variables?: import('./email-template.registry').TemplateVariableDescriptor[];
		version: number;
		isActive: boolean;
	}): Promise<EmailTemplateSchemaType> {
		return this.db
			.insert(schema.emailTemplates)
			.values(template)
			.returning()
			.then(rows => rows[0]);
	}

	async deactivateByKeyAndVersion(key: string, version: number): Promise<void> {
		await this.db
			.update(schema.emailTemplates)
			.set({ isActive: false })
			.where(
				and(
					eq(schema.emailTemplates.key, key),
					eq(schema.emailTemplates.version, version),
				),
			);
	}

	private getWhereClause(query: EmailTemplateListQueryDto): SQL<unknown> | undefined {
		const conditions: (SQL<unknown> | undefined)[] = [];

		if (query.search) {
			const q = `%${query.search}%`;
			conditions.push(
				or(
					ilike(schema.emailTemplates.key, q),
					ilike(schema.emailTemplates.subject, q),
				),
			);
		}

		if (typeof query.isActive === 'boolean') {
			conditions.push(eq(schema.emailTemplates.isActive, query.isActive));
		}

		if (query.fromDate) {
			conditions.push(gte(schema.emailTemplates.createdAt, new Date(query.fromDate)));
		}

		if (query.toDate) {
			const toDate = new Date(query.toDate);
			toDate.setHours(23, 59, 59, 999);
			conditions.push(lte(schema.emailTemplates.createdAt, toDate));
		}

		const filtered = conditions.filter(Boolean) as SQL<unknown>[];
		return filtered.length > 0 ? and(...filtered) : undefined;
	}
}
