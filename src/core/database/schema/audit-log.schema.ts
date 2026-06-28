import {
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { timestamps } from '../helpers';
import { users } from './auth.schema';
import { roleTypeEnum } from './enum.schema';

export const auditLogs = pgTable(
	'audit_logs',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
		actorRole: roleTypeEnum('actor_role'),
		actorName: text('actor_name'),
		actorEmail: text('actor_email'),
		action: varchar('action', { length: 100 }).notNull(),
		targetType: varchar('target_type', { length: 50 }).notNull(),
		targetId: varchar('target_id', { length: 100 }).notNull(),
		metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		...timestamps,
	},
	table => [
		uniqueIndex('audit_logs_public_id_idx').on(table.publicId),
		index('audit_logs_actor_id_idx').on(table.actorId),
		index('audit_logs_action_idx').on(table.action),
		index('audit_logs_target_id_idx').on(table.targetId),
		index('audit_logs_created_at_idx').on(table.createdAt),
		index('audit_logs_actor_email_idx').on(table.actorEmail),
	],
);
