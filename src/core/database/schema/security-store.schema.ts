import { index, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from '../helpers';

/**
 * Key-value store table for security-related state:
 * rate limiting counters, brute-force tracking, lockouts, etc.
 *
 * Works across multiple app instances since all share the same database.
 * Expired entries are cleaned up on each write operation.
 */
export const securityCache = pgTable(
	'security_cache',
	{
		id: serial('id').primaryKey(),
		key: varchar('key', { length: 512 }).notNull().unique(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		...timestamps,
	},
	table => [
		uniqueIndex('security_cache_key_idx').on(table.key),
		index('security_cache_expires_at_idx').on(table.expiresAt),
	],
);
