import {
	boolean,
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
import type { TemplateVariableDescriptor } from '../../../app/email-template/email-template.registry';

export const emailTemplates = pgTable(
	'email_templates',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		key: varchar('key', { length: 120 }).notNull(),
		subject: text('subject').notNull(),
		html: text('html').notNull(),
		text: text('text'),
		variables: jsonb('variables').$type<TemplateVariableDescriptor[]>().notNull().default([]),
		version: integer('version').default(1).notNull(),
		isActive: boolean('is_active').default(true).notNull(),
		...timestamps,
	},
	table => [
		uniqueIndex('email_templates_public_id_idx').on(table.publicId),
		uniqueIndex('email_templates_key_version_idx').on(table.key, table.version),
		index('email_templates_key_is_active_version_idx').on(table.key, table.isActive, table.version),
	],
);
