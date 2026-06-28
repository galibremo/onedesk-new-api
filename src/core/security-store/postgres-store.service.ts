import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../database/connection';
import schema from '../database/schema';
import type { ISecurityStore } from './security-store.interface';

type SecurityDb = NodePgDatabase<typeof schema>;

/**
 * PostgreSQL-backed security store for multi-instance deployments.
 *
 * Uses the security_cache table as a key-value store with optional TTL.
 * All app instances share the same database, so rate limits and brute-force
 * tracking work correctly across multiple instances.
 *
 * Expired entries are cleaned up lazily on each write operation.
 */
@Injectable()
export class PostgresSecurityStore implements ISecurityStore, OnModuleDestroy {
	private readonly logger = new Logger(PostgresSecurityStore.name);
	private readonly cleanupInterval: ReturnType<typeof setInterval>;

	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: SecurityDb,
	) {
		this.cleanupInterval = setInterval(() => {
			this.cleanup().catch(err => {
				this.logger.warn('Failed to cleanup expired security cache entries', err);
			});
		}, 5 * 60_000);
		this.cleanupInterval.unref();
	}

	async increment(key: string, ttlMs: number): Promise<number> {
		const expiresAt = new Date(Date.now() + ttlMs);

		const result = await this.db
			.insert(schema.securityCache)
			.values({
				key,
				value: '1',
				expiresAt,
			})
			.onConflictDoUpdate({
				target: schema.securityCache.key,
				set: {
					value: sql`CASE
						WHEN ${schema.securityCache.expiresAt} IS NULL OR ${schema.securityCache.expiresAt} > NOW()
						THEN (${schema.securityCache.value}::int + 1)::text
						ELSE '1'
					END`,
				},
			})
			.returning({ value: schema.securityCache.value });

		return Number(result[0]?.value ?? 1);
	}

	async get(key: string): Promise<string | null> {
		const result = await this.db
			.select({ value: schema.securityCache.value })
			.from(schema.securityCache)
			.where(
				and(
					eq(schema.securityCache.key, key),
					orCondition(
						sql`${schema.securityCache.expiresAt} IS NULL`,
						gt(schema.securityCache.expiresAt, new Date()),
					),
				),
			)
			.limit(1);

		return result[0]?.value ?? null;
	}

	async set(key: string, value: string, ttlMs?: number): Promise<void> {
		const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : null;

		await this.db
			.insert(schema.securityCache)
			.values({ key, value, expiresAt })
			.onConflictDoUpdate({
				target: schema.securityCache.key,
				set: { value, expiresAt },
			});
	}

	async delete(key: string): Promise<void> {
		await this.db.delete(schema.securityCache).where(eq(schema.securityCache.key, key));
	}

	async has(key: string): Promise<boolean> {
		const result = await this.get(key);
		return result !== null;
	}

	async recordFailedAttempt(key: string, ttlMs: number): Promise<number> {
		return this.increment(key, ttlMs);
	}

	async getFailedAttempts(key: string): Promise<number> {
		const value = await this.get(key);
		return value ? Number(value) : 0;
	}

	async clearFailedAttempts(key: string): Promise<void> {
		await this.delete(key);
	}

	async isLockedOut(key: string): Promise<boolean> {
		return this.has(key);
	}

	async setLockout(key: string, ttlMs: number): Promise<void> {
		await this.set(key, 'locked', ttlMs);
	}

	async deleteLockout(key: string): Promise<void> {
		await this.delete(key);
	}

	async cleanup(): Promise<void> {
		await this.cleanupExpired();
	}

	private async cleanupExpired(): Promise<void> {
		try {
			await this.db
				.delete(schema.securityCache)
				.where(
					and(
						sql`${schema.securityCache.expiresAt} IS NOT NULL`,
						sql`${schema.securityCache.expiresAt} < NOW()`,
					),
				);
		} catch {
			// Silently ignore cleanup failures — they are non-critical
		}
	}

	onModuleDestroy(): void {
		clearInterval(this.cleanupInterval);
	}

	shutdown(): Promise<void> {
		this.onModuleDestroy();
		return Promise.resolve();
	}
}

function orCondition(...conditions: ReturnType<typeof sql>[]): ReturnType<typeof sql> {
	return sql`(${sql.join(conditions, sql` OR `)})`;
}
