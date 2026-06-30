import { relations } from 'drizzle-orm';

import { auditLogs } from './audit-log.schema';
import { accounts, sessions, twoFactorRecoveryCodes, twoFactorSetups, users } from './auth.schema';
import { channels } from './channel.schema';
import { team, teamMembers } from './team.schema';

export const usersRelations = relations(users, ({ many }) => ({
	auditLogs: many(auditLogs),
	accounts: many(accounts),
	sessions: many(sessions),
	twoFactorSetups: many(twoFactorSetups),
	twoFactorRecoveryCodes: many(twoFactorRecoveryCodes),
}));

// Relationships
export const teamRelations = relations(team, ({ many, one }) => ({
	owner: one(users, {
		fields: [team.ownerId],
		references: [users.id],
	}),
	teamMembers: many(teamMembers),
	currentForUsers: many(users),
	channels: many(channels),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
	team: one(team, {
		fields: [teamMembers.teamId],
		references: [team.id],
	}),
	user: one(users, {
		fields: [teamMembers.userId],
		references: [users.id],
	}),
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
