import { relations } from 'drizzle-orm';

import { auditLogs } from './audit-log.schema';
import { accounts, sessions, twoFactorRecoveryCodes, twoFactorSetups, users } from './auth.schema';
import { organizationMembers, organizations } from './organization.schema';

export const usersRelations = relations(users, ({ many }) => ({
	auditLogs: many(auditLogs),
	accounts: many(accounts),
	sessions: many(sessions),
	twoFactorSetups: many(twoFactorSetups),
	twoFactorRecoveryCodes: many(twoFactorRecoveryCodes),
	ownedOrganizations: many(organizations),
	organizationMemberships: many(organizationMembers),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
	actor: one(users, {
		fields: [auditLogs.actorId],
		references: [users.id],
	}),
}));

export const twoFactorSetupsRelations = relations(twoFactorSetups, ({ one }) => ({
	user: one(users, {
		fields: [twoFactorSetups.userId],
		references: [users.id],
	}),
}));

export const twoFactorRecoveryCodesRelations = relations(twoFactorRecoveryCodes, ({ one }) => ({
	user: one(users, {
		fields: [twoFactorRecoveryCodes.userId],
		references: [users.id],
	}),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
	owner: one(users, {
		fields: [organizations.ownerId],
		references: [users.id],
	}),
	members: many(organizationMembers),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
	user: one(users, {
		fields: [organizationMembers.userId],
		references: [users.id],
	}),
	organization: one(organizations, {
		fields: [organizationMembers.organizationId],
		references: [organizations.id],
	}),
}));

