import { index, integer, pgEnum, pgTable, serial, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from '../helpers';
import { users } from './auth.schema';

export const organizationRoleEnum = pgEnum('organization_role', ['ADMIN', 'SUPERVISOR', 'AGENT']);
export const organizationMemberStatusEnum = pgEnum('organization_member_status', [
	'ACTIVE',
	'INACTIVE',
	'INVITED',
]);

export const organizations = pgTable(
	'organizations',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		name: text('name').notNull(),
		slug: text('slug').unique(),
		description: text('description'),
		logo: text('logo'),
		logoPublicId: text('logo_public_id'),
		industry: text('industry'),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...timestamps,
	},
	t => [
		uniqueIndex('organizations_public_id_idx').on(t.publicId),
		uniqueIndex('organizations_name_owner_idx').on(t.name, t.ownerId),
		index('organizations_owner_id_idx').on(t.ownerId),
		index('organizations_slug_idx').on(t.slug),
	],
);

export const organizationMembers = pgTable(
	'organization_members',
	{
		id: serial('id').primaryKey(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		organizationId: integer('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		role: organizationRoleEnum('role').notNull(),
		status: organizationMemberStatusEnum('status').notNull().default('INVITED'),
		...timestamps,
	},
	t => [
		uniqueIndex('org_members_public_id_idx').on(t.publicId),
		uniqueIndex('org_members_user_org_idx').on(t.userId, t.organizationId),
		index('org_members_org_id_idx').on(t.organizationId),
		index('org_members_user_id_idx').on(t.userId),
		index('org_members_status_idx').on(t.status),
	],
);
