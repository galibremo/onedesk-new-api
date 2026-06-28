import {
	boolean,
	index,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { timestamps } from '../helpers';

export const smtpProviders = pgTable(
	'smtp_providers',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		name: varchar('name', { length: 100 }).notNull(),
		providerType: varchar('provider_type', { length: 30 }).notNull(),
		config: text('config').notNull(),
		isDefault: boolean('is_default').default(false).notNull(),
		isActive: boolean('is_active').default(true).notNull(),
		lastTestedAt: timestamp('last_tested_at'),
		lastTestStatus: varchar('last_test_status', { length: 20 }),
		...timestamps,
	},
	table => [
		index('smtp_providers_public_id_idx').on(table.publicId),
		index('smtp_providers_provider_type_idx').on(table.providerType),
		index('smtp_providers_default_active_idx').on(table.isDefault, table.isActive),
	],
);
