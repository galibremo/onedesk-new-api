import {
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { timestamps } from '../helpers';
import { smtpProviders } from './smtp-provider.schema';

export const emailLogs = pgTable(
	'email_logs',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		smtpProviderId: integer('smtp_provider_id')
			.references(() => smtpProviders.id, { onDelete: 'set null' }),
		toEmail: varchar('to_email', { length: 255 }).notNull(),
		toName: varchar('to_name', { length: 255 }),
		subject: text('subject').notNull(),
		templateKey: varchar('template_key', { length: 100 }),
		status: varchar('status', { length: 20 }).notNull(),
		errorMessage: text('error_message'),
		metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
		...timestamps,
	},
	table => [
		index('email_logs_public_id_idx').on(table.publicId),
		index('email_logs_smtp_provider_id_idx').on(table.smtpProviderId),
		index('email_logs_status_idx').on(table.status),
		index('email_logs_to_email_idx').on(table.toEmail),
		index('email_logs_created_at_idx').on(table.createdAt),
	],
);
