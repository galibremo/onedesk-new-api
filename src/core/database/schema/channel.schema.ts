import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from '../helpers';
import { users } from './auth.schema';

export const channelTypeEnum = pgEnum('channel_type', [
	'facebook',
	'whatsapp',
	'instagram',
	'telegram',
]);

export const channelStatusEnum = pgEnum('channel_status', ['active', 'disconnected']);

export const facebookPageStatusEnum = pgEnum('facebook_page_status', ['active', 'disconnected']);

export const channels = pgTable(
	'channels',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		name: text('name').notNull(),
		channelType: channelTypeEnum('channel_type').notNull(),
		status: channelStatusEnum('status').notNull().default('active'),
		channelConfig: jsonb('channel_config'),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		...timestamps,
	},
	table => [
		index('channels_public_id_idx').on(table.publicId),
		index('channels_user_id_idx').on(table.userId),
		index('channels_type_idx').on(table.channelType),
		index('channels_status_idx').on(table.status),
	],
);

export const facebookAccounts = pgTable(
	'facebook_accounts',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		facebookUserId: varchar('facebook_user_id', { length: 100 }).notNull(),
		accessToken: text('access_token').notNull(),
		tokenExpiration: timestamp('token_expiration', { withTimezone: true }),
		...timestamps,
	},
	table => [
		index('fb_accounts_public_id_idx').on(table.publicId),
		index('fb_accounts_user_id_idx').on(table.userId),
		index('fb_accounts_fb_user_id_idx').on(table.facebookUserId),
		uniqueIndex('fb_accounts_user_fb_user_idx').on(table.userId, table.facebookUserId),
	],
);

export const facebookPages = pgTable(
	'facebook_pages',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		facebookAccountId: integer('facebook_account_id')
			.notNull()
			.references(() => facebookAccounts.id, { onDelete: 'cascade' }),
		facebookPageId: varchar('facebook_page_id', { length: 100 }).notNull(),
		pageName: varchar('page_name', { length: 255 }).notNull(),
		pageAccessToken: text('page_access_token').notNull(),
		pageCategory: varchar('page_category', { length: 100 }),
		profilePicture: text('profile_picture'),
		pageStatus: facebookPageStatusEnum('page_status').default('disconnected').notNull(),
		connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
		...timestamps,
	},
	table => [
		index('fb_pages_public_id_idx').on(table.publicId),
		index('fb_pages_user_id_idx').on(table.userId),
		index('fb_pages_account_id_idx').on(table.facebookAccountId),
		index('fb_pages_fb_page_id_idx').on(table.facebookPageId),
		uniqueIndex('fb_pages_user_fb_page_idx').on(table.userId, table.facebookPageId),
	],
);

export const instagramAccounts = pgTable(
	'instagram_accounts',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		instagramUserId: varchar('instagram_user_id', { length: 100 }).notNull(),
		accessToken: text('access_token').notNull(),
		tokenExpiration: timestamp('token_expiration', { withTimezone: true }),
		...timestamps,
	},
	table => [
		index('ig_accounts_public_id_idx').on(table.publicId),
		index('ig_accounts_user_id_idx').on(table.userId),
		index('ig_accounts_ig_user_id_idx').on(table.instagramUserId),
		uniqueIndex('ig_accounts_user_ig_user_idx').on(table.userId, table.instagramUserId),
	],
);

export const whatsappAccounts = pgTable(
	'whatsapp_accounts',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		whatsappUserId: varchar('whatsapp_user_id', { length: 100 }).notNull(),
		accessToken: text('access_token').notNull(),
		tokenExpiration: timestamp('token_expiration', { withTimezone: true }),
		...timestamps,
	},
	table => [
		index('wa_accounts_public_id_idx').on(table.publicId),
		index('wa_accounts_user_id_idx').on(table.userId),
		index('wa_accounts_wa_user_id_idx').on(table.whatsappUserId),
		uniqueIndex('wa_accounts_user_wa_user_idx').on(table.userId, table.whatsappUserId),
	],
);
