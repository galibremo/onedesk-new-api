import { UploadApiResponse } from 'cloudinary';
import { sql } from 'drizzle-orm';
import {
	boolean,
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
import { roleTypeEnum } from './enum.schema';

export const teamRoleEnum = pgEnum('team_role', ['TEAM_LEAD', 'AGENT']);

export const users = pgTable(
	'users',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		name: text('name'),
		email: text('email').notNull().unique(),
		password: text('password'),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),
		imageInformation: jsonb('image_information').$type<UploadApiResponse>(),
		phone: varchar('phone', { length: 20 }),
		is2faEnabled: boolean('is_2fa_enabled').default(false).notNull(),
		twoFactorSecretEncrypted: text('two_factor_secret_encrypted'),
		role: roleTypeEnum('role').default('USER').notNull(),
		isApproved: boolean('is_approved').default(true).notNull(),
		currentTeamId: uuid('current_team_id'),
		currentTeamRole: teamRoleEnum('current_team_role'),
		...timestamps,
	},
	table => [
		uniqueIndex('users_public_id_idx').on(table.publicId),
		uniqueIndex('users_email_idx').on(table.email),
		index('users_email_verified_idx').on(table.emailVerified),
		index('users_is_2fa_enabled_idx').on(table.is2faEnabled),
		// For case-insensitive search performance
		index('users_name_lower_idx').on(sql`LOWER(${table.name})`),
		index('users_email_lower_idx').on(sql`LOWER(${table.email})`),
	],
);

export const sessions = pgTable(
	'sessions',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		token: text('token').notNull().unique(),
		ipAddress: text('ip_address').default('Unknown'),
		userAgent: text('user_agent').default('Unknown'),
		deviceName: varchar('device_name', { length: 255 }).default('Unknown Device'),
		deviceType: varchar('device_type', { length: 50 }).default('Unknown'),
		twoFactorVerified: boolean('two_factor_verified').default(false).notNull(),
		twoFactorFailedAttempts: integer('two_factor_failed_attempts').default(0).notNull(),
		twoFactorLockedUntil: timestamp('two_factor_locked_until'),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at').notNull(),
		isRevoked: boolean('is_revoked').default(false).notNull(),
		...timestamps,
	},
	table => [
		uniqueIndex('sessions_public_id_idx').on(table.publicId),
		uniqueIndex('sessions_token_idx').on(table.token),
		index('sessions_user_id_idx').on(table.userId),
		index('sessions_expires_at_idx').on(table.expiresAt),
		index('sessions_is_revoked_idx').on(table.isRevoked),
		index('sessions_user_id_is_revoked_idx').on(table.userId, table.isRevoked),
		index('sessions_user_id_expires_at_idx').on(table.userId, table.expiresAt),
	],
);

export const twoFactorSetups = pgTable(
	'two_factor_setups',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		secretEncrypted: text('secret_encrypted').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		...timestamps,
	},
	table => [
		uniqueIndex('two_factor_setups_public_id_idx').on(table.publicId),
		uniqueIndex('two_factor_setups_user_id_idx').on(table.userId),
		index('two_factor_setups_expires_at_idx').on(table.expiresAt),
	],
);

export const twoFactorRecoveryCodes = pgTable(
	'two_factor_recovery_codes',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		codeHash: text('code_hash').notNull(),
		usedAt: timestamp('used_at'),
		...timestamps,
	},
	table => [
		uniqueIndex('two_factor_recovery_codes_public_id_idx').on(table.publicId),
		uniqueIndex('two_factor_recovery_codes_user_code_hash_idx').on(table.userId, table.codeHash),
		index('two_factor_recovery_codes_user_id_idx').on(table.userId),
		index('two_factor_recovery_codes_used_at_idx').on(table.usedAt),
	],
);

export const accounts = pgTable(
	'accounts',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		...timestamps,
	},
	table => [
		uniqueIndex('accounts_public_id_idx').on(table.publicId),
		uniqueIndex('accounts_account_id_provider_id_idx').on(table.accountId, table.providerId),
		index('accounts_user_id_idx').on(table.userId),
		index('accounts_provider_id_idx').on(table.providerId),
		index('accounts_access_token_expires_at_idx').on(table.accessTokenExpiresAt),
	],
);

export const verifications = pgTable(
	'verifications',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		...timestamps,
	},
	table => [
		uniqueIndex('verifications_public_id_idx').on(table.publicId),
		index('verifications_identifier_idx').on(table.identifier),
		index('verifications_value_idx').on(table.value),
		index('verifications_expires_at_idx').on(table.expiresAt),
		index('verifications_identifier_value_idx').on(table.identifier, table.value),
	],
);
