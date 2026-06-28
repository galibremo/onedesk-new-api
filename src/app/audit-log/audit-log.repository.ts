import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import { orderByColumn } from '../../core/database/helpers';
import schema from '../../core/database/schema';
import type { RoleTypeEnum } from '../../core/database/types';
import type { AuditLogRow } from './audit-log.mapper';
import type { AuditLogListQueryDto } from './audit-log.schema';

export type AuditLogDatabase = NodePgDatabase<typeof schema>;

export interface CreateAuditLogData {
	actorId: number | null;
	actorRole: RoleTypeEnum | null;
	actorName: string | null;
	actorEmail: string | null;
	action: string;
	targetType: string;
	targetId: string;
	metadata?: Record<string, unknown>;
	ipAddress?: string | null;
	userAgent?: string | null;
}

@Injectable()
export class AuditLogRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: AuditLogDatabase,
	) {}

	async create(data: CreateAuditLogData): Promise<void> {
		await this.db.insert(schema.auditLogs).values({
			actorId: data.actorId,
			actorRole: data.actorRole,
			actorName: data.actorName,
			actorEmail: data.actorEmail,
			action: data.action,
			targetType: data.targetType,
			targetId: data.targetId,
			metadata: data.metadata ?? {},
			ipAddress: data.ipAddress ?? null,
			userAgent: data.userAgent ?? null,
		});
	}

	async list(query: AuditLogListQueryDto): Promise<{
		rows: AuditLogRow[];
		total: number;
		page: number;
		pageSize: number;
	}> {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;
		const whereClause = this.getListWhere(query);
		const orderBy = orderByColumn(schema.auditLogs, query.sort, query.dir);

		const [rows, totalRows] = await Promise.all([
			this.db
				.select(this.auditLogSelection())
				.from(schema.auditLogs)
				.leftJoin(schema.users, eq(schema.auditLogs.actorId, schema.users.id))
				.where(whereClause)
				.orderBy(orderBy ?? desc(schema.auditLogs.createdAt))
				.limit(pageSize)
				.offset(offset),
			this.db
				.select({ value: count() })
				.from(schema.auditLogs)
				.leftJoin(schema.users, eq(schema.auditLogs.actorId, schema.users.id))
				.where(whereClause),
		]);

		return {
			rows,
			total: Number(totalRows[0]?.value ?? 0),
			page,
			pageSize,
		};
	}

	async getDistinctActions(): Promise<string[]> {
		const results = await this.db
			.selectDistinct({ action: schema.auditLogs.action })
			.from(schema.auditLogs)
			.orderBy(schema.auditLogs.action);

		return results.map(row => row.action);
	}

	async getDistinctTargetTypes(): Promise<string[]> {
		const results = await this.db
			.selectDistinct({ targetType: schema.auditLogs.targetType })
			.from(schema.auditLogs)
			.orderBy(schema.auditLogs.targetType);

		return results.map(row => row.targetType);
	}

	private getListWhere(query: AuditLogListQueryDto): SQL<unknown> | undefined {
		const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
		const toDate = query.toDate ? new Date(query.toDate) : undefined;

		if (toDate) {
			toDate.setHours(23, 59, 59, 999);
		}

		const actorSearch = query.actor
			? sql`(${schema.auditLogs.actorName} ILIKE ${`%${query.actor}%`} OR ${schema.auditLogs.actorEmail} ILIKE ${`%${query.actor}%`} OR ${schema.users.name} ILIKE ${`%${query.actor}%`} OR ${schema.users.email} ILIKE ${`%${query.actor}%`})`
			: undefined;

		const conditions = [
			query.actorId ? eq(schema.users.publicId, query.actorId) : undefined,
			actorSearch,
			query.action ? eq(schema.auditLogs.action, query.action) : undefined,
			query.targetType ? eq(schema.auditLogs.targetType, query.targetType) : undefined,
			fromDate ? gte(schema.auditLogs.createdAt, fromDate) : undefined,
			toDate ? lte(schema.auditLogs.createdAt, toDate) : undefined,
		].filter(Boolean) as SQL<unknown>[];

		return conditions.length > 0 ? and(...conditions) : undefined;
	}

	private auditLogSelection() {
		return {
			publicId: schema.auditLogs.publicId,
			actorPublicId: schema.users.publicId,
			actorRole: schema.auditLogs.actorRole,
			actorName: sql<string>`coalesce(${schema.auditLogs.actorName}, ${schema.users.name})`.as(
				'actorName',
			),
			actorEmail: sql<string>`coalesce(${schema.auditLogs.actorEmail}, ${schema.users.email})`.as(
				'actorEmail',
			),
			action: schema.auditLogs.action,
			targetType: schema.auditLogs.targetType,
			targetId: schema.auditLogs.targetId,
			metadata: schema.auditLogs.metadata,
			ipAddress: schema.auditLogs.ipAddress,
			userAgent: schema.auditLogs.userAgent,
			createdAt: schema.auditLogs.createdAt,
			updatedAt: schema.auditLogs.updatedAt,
		};
	}
}
