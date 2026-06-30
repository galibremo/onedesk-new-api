import {
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

import { timestamps } from '../helpers';
import { teamRoleEnum, users } from './auth.schema';

export const teamStatusEnum = pgEnum('team_status_enum', ['ACTIVE', 'INACTIVE']);
export const teamMemberStatusEnum = pgEnum('team_member_status_enum', [
	'ACTIVE',
	'INACTIVE',
	'INVITED',
]);

export const team = pgTable(
	'team',
	{
		id: serial('id').primaryKey().notNull(),
		publicId: uuid('public_id').defaultRandom().notNull().unique(),
		name: varchar('name', { length: 255 }).notNull(),
		slug: text('slug'),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => users.id, {
				onDelete: 'cascade',
			}),
		status: teamStatusEnum('status').notNull().default('ACTIVE'),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		...timestamps,
	},
	table => [
		unique('team_slug_unique').on(table.slug),
		unique('team_name_owner_unique').on(table.ownerId, table.name),
	],
);

export const teamMembers = pgTable(
	'team_members',
	{
		teamId: integer('team_id')
			.notNull()
			.references(() => team.id, {
				onDelete: 'cascade',
			}),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, {
				onDelete: 'cascade',
			}),
		role: teamRoleEnum('role').notNull(),
		status: teamMemberStatusEnum('status').notNull().default('INVITED'),
	},
	table => [unique('team_users_role_unique').on(table.teamId, table.userId, table.role)],
);
