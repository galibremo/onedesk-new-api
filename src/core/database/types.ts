import type { InferSelectModel } from 'drizzle-orm';
import {
	accounts,
	sessions,
	twoFactorRecoveryCodes,
	twoFactorSetups,
	users,
} from './schema/auth.schema';
import { auditLogs } from './schema/audit-log.schema';
import { emailTemplates } from './schema/email-template.schema';
import { roleTypeEnum } from './schema/enum.schema';
import { media } from './schema/media.schema';
import { securityCache } from './schema/security-store.schema';
import { emailLogs } from './schema/email-log.schema';
import { smtpProviders } from './schema/smtp-provider.schema';
import { systemSettings } from './schema/system.schema';
import {
	channels,
	channelStatusEnum,
	channelTypeEnum,
	facebookAccounts,
	facebookPageStatusEnum,
	instagramAccounts,
	whatsappAccounts,
} from './schema/channel.schema';
import { teamRoleEnum } from './schema/auth.schema';
import { team, teamMembers, teamStatusEnum, teamMemberStatusEnum } from './schema/team.schema';

/**
 * Schema Types
 */
export type UserSchemaType = InferSelectModel<typeof users>;
export type AccountSchemaType = InferSelectModel<typeof accounts>;
export type SessionSchemaType = InferSelectModel<typeof sessions>;
export type TwoFactorSetupSchemaType = InferSelectModel<typeof twoFactorSetups>;
export type TwoFactorRecoveryCodeSchemaType = InferSelectModel<typeof twoFactorRecoveryCodes>;
export type AuditLogSchemaType = InferSelectModel<typeof auditLogs>;
export type MediaSchemaType = InferSelectModel<typeof media>;
export type EmailTemplateSchemaType = InferSelectModel<typeof emailTemplates>;
export type SystemSettingsSchemaType = InferSelectModel<typeof systemSettings>;
export type SecurityCacheSchemaType = InferSelectModel<typeof securityCache>;
export type SmtpProviderSchemaType = InferSelectModel<typeof smtpProviders>;
export type EmailLogSchemaType = InferSelectModel<typeof emailLogs>;

export type ChannelSchemaType = InferSelectModel<typeof channels>;
export type FacebookAccountSchemaType = InferSelectModel<typeof facebookAccounts>;
export type InstagramAccountSchemaType = InferSelectModel<typeof instagramAccounts>;
export type WhatsAppAccountSchemaType = InferSelectModel<typeof whatsappAccounts>;

/**
 * Enum Schema Types
 */
export type RoleTypeEnum = (typeof roleTypeEnum.enumValues)[number];
export type FacebookPageStatusEnum = (typeof facebookPageStatusEnum.enumValues)[number];
export type ChannelTypeEnum = (typeof channelTypeEnum.enumValues)[number];
export type ChannelStatusEnum = (typeof channelStatusEnum.enumValues)[number];
export type TeamRoleEnum = (typeof teamRoleEnum.enumValues)[number];
export type TeamStatusEnum = (typeof teamStatusEnum.enumValues)[number];
export type TeamMemberStatusEnum = (typeof teamMemberStatusEnum.enumValues)[number];

export type TeamSchemaType = InferSelectModel<typeof team>;
export type TeamMemberSchemaType = InferSelectModel<typeof teamMembers>;
