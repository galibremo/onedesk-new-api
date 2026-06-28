import { pgTable, serial, text } from 'drizzle-orm/pg-core';
import { timestamps } from '../helpers';
import { accessModelEnum } from './enum.schema';

export const systemSettings = pgTable('system_settings', {
	id: serial('id').primaryKey(),
	accessModel: accessModelEnum('access_model').default('OPEN').notNull(),
	allowedRoles: text('allowed_roles')
		.array()
		.notNull()
		.default(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']),
	...timestamps,
});
