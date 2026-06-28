import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gt, gte, ilike, inArray, lte, ne, or, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../../core/database/connection';
import { orderByColumn } from '../../../core/database/helpers';
import schema from '../../../core/database/schema';
import type { SessionSchemaType } from '../../../core/database/types';
import type { SessionListQueryDto } from './session.schema';
import type { SessionDataType, SessionStatus } from './session.types';

export type SessionDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class SessionRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: SessionDatabase,
	) {}

	async createSession(data: SessionDataType): Promise<SessionSchemaType> {
		return this.db
			.insert(schema.sessions)
			.values(data)
			.returning()
			.then(rows => rows[0]);
	}

	findSession(
		userId: number,
		sessionKeyOrId: string | number,
	): Promise<SessionSchemaType | undefined> {
		return this.db.query.sessions.findFirst({
			where: and(
				this.getSessionIdentityCondition(sessionKeyOrId),
				eq(schema.sessions.userId, userId),
			),
		});
	}

	findSessionByPublicIdForUser(
		userId: number,
		publicId: string,
	): Promise<SessionSchemaType | undefined> {
		return this.db.query.sessions.findFirst({
			where: and(eq(schema.sessions.publicId, publicId), eq(schema.sessions.userId, userId)),
		});
	}

	async extendSession(sessionId: number, expiresAt: Date): Promise<SessionSchemaType | undefined> {
		return this.db
			.update(schema.sessions)
			.set({ expiresAt })
			.where(eq(schema.sessions.id, sessionId))
			.returning()
			.then(rows => rows[0]);
	}

	async markTwoFactorVerified(sessionId: number): Promise<SessionSchemaType | undefined> {
		return this.db
			.update(schema.sessions)
			.set({
				twoFactorVerified: true,
				twoFactorFailedAttempts: 0,
				twoFactorLockedUntil: null,
			})
			.where(eq(schema.sessions.id, sessionId))
			.returning()
			.then(rows => rows[0]);
	}

	async updateTwoFactorFailureState(
		sessionId: number,
		data: Pick<Partial<SessionSchemaType>, 'twoFactorFailedAttempts' | 'twoFactorLockedUntil'>,
	): Promise<SessionSchemaType | undefined> {
		return this.db
			.update(schema.sessions)
			.set(data)
			.where(eq(schema.sessions.id, sessionId))
			.returning()
			.then(rows => rows[0]);
	}

	async revokeSession(userId: number, sessionKeyOrId: string | number): Promise<void> {
		await this.db
			.update(schema.sessions)
			.set({ isRevoked: true })
			.where(
				and(this.getSessionIdentityCondition(sessionKeyOrId), eq(schema.sessions.userId, userId)),
			);
	}

	async revokeSessionByPublicIdForUser(
		userId: number,
		publicId: string,
	): Promise<SessionSchemaType | undefined> {
		return this.db
			.update(schema.sessions)
			.set({ isRevoked: true })
			.where(and(eq(schema.sessions.publicId, publicId), eq(schema.sessions.userId, userId)))
			.returning()
			.then(rows => rows[0]);
	}

	async revokeOtherActiveUserSessions(
		userId: number,
		currentSessionToken: string,
		now: Date = new Date(),
	): Promise<number> {
		const result = await this.db
			.update(schema.sessions)
			.set({ isRevoked: true })
			.where(
				and(
					eq(schema.sessions.userId, userId),
					eq(schema.sessions.isRevoked, false),
					gt(schema.sessions.expiresAt, now),
					ne(schema.sessions.token, currentSessionToken),
				),
			)
			.returning({ id: schema.sessions.id });

		return result.length;
	}

	async revokeAllUserSessions(userId: number): Promise<number> {
		const result = await this.db
			.update(schema.sessions)
			.set({ isRevoked: true })
			.where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.isRevoked, false)))
			.returning();

		return result.length;
	}

	listUserSessions(userId: number): Promise<SessionSchemaType[]> {
		return this.db.query.sessions.findMany({
			where: eq(schema.sessions.userId, userId),
			orderBy: desc(schema.sessions.createdAt),
		});
	}

	async listUserSessionsPaginated(
		userId: number,
		query: SessionListQueryDto,
		currentSessionToken: string,
	): Promise<{
		rows: SessionSchemaType[];
		total: number;
		activeOtherSessionCount: number;
	}> {
		const now = new Date();
		const whereClause = this.getListSessionsWhere(userId, query, now);

		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;

		const orderBy = orderByColumn(schema.sessions, query.sort, query.dir);

		const [rows, totalRows, activeOtherSessionRows] = await Promise.all([
			this.db
				.select()
				.from(schema.sessions)
				.where(whereClause)
				.orderBy(orderBy ?? desc(schema.sessions.createdAt))
				.limit(pageSize)
				.offset(offset),
			this.db.select({ value: count() }).from(schema.sessions).where(whereClause),
			this.db
				.select({ value: count() })
				.from(schema.sessions)
				.where(
					and(
						eq(schema.sessions.userId, userId),
						eq(schema.sessions.isRevoked, false),
						gt(schema.sessions.expiresAt, now),
						ne(schema.sessions.token, currentSessionToken),
					),
				),
		]);

		return {
			rows,
			total: Number(totalRows[0]?.value ?? 0),
			activeOtherSessionCount: Number(activeOtherSessionRows[0]?.value ?? 0),
		};
	}

	private getSessionIdentityCondition(sessionKeyOrId: string | number) {
		return typeof sessionKeyOrId === 'number'
			? eq(schema.sessions.id, sessionKeyOrId)
			: eq(schema.sessions.token, sessionKeyOrId);
	}

	private getListSessionsWhere(
		userId: number,
		query: SessionListQueryDto,
		now: Date,
	): SQL<unknown> | undefined {
		const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
		const toDate = query.toDate ? new Date(query.toDate) : undefined;

		if (toDate) {
			toDate.setHours(23, 59, 59, 999);
		}

		const q = query.search ? `%${query.search}%` : undefined;
		const searchExists = q
			? or(
					ilike(schema.sessions.deviceName, q),
					ilike(schema.sessions.deviceType, q),
					ilike(schema.sessions.ipAddress, q),
					ilike(schema.sessions.userAgent, q),
				)
			: undefined;

		const conditions = [
			eq(schema.sessions.userId, userId),
			searchExists,
			query.status?.length
				? or(...query.status.map(status => this.getSessionStatusCondition(status, now)))
				: undefined,
			query.deviceType?.length ? inArray(schema.sessions.deviceType, query.deviceType) : undefined,
			fromDate ? gte(schema.sessions.createdAt, fromDate) : undefined,
			toDate ? lte(schema.sessions.createdAt, toDate) : undefined,
		].filter(Boolean) as SQL<unknown>[];

		return conditions.length > 0 ? and(...conditions) : undefined;
	}

	private getSessionStatusCondition(status: SessionStatus, now: Date): SQL<unknown> {
		if (status === 'active') {
			return and(eq(schema.sessions.isRevoked, false), gt(schema.sessions.expiresAt, now))!;
		}

		if (status === 'revoked') {
			return eq(schema.sessions.isRevoked, true);
		}

		return and(eq(schema.sessions.isRevoked, false), lte(schema.sessions.expiresAt, now))!;
	}
}
