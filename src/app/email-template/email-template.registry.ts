import type { RoleTypeEnum } from '../../core/database/types';

// ─── Template Key Constants ────────────────────────────────────────────────────

export const TEMPLATE_KEYS = {
	AUTH_ACCOUNT_APPROVAL: 'auth_account_approval',
	AUTH_INVITATION: 'auth_invitation',
	AUTH_MAGIC_LINK: 'auth_magic_link',
	AUTH_TWO_FACTOR_ALERT: 'auth_two_factor_alert',
	AUTH_WELCOME: 'auth_welcome',
} as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS];

// ─── Variable Descriptor (stored in DB) ────────────────────────────────────────

export type TemplateVariableType = 'string' | 'number' | 'boolean';

export interface TemplateVariableDescriptor {
	name: string;
	type: TemplateVariableType;
	required: boolean;
	description: string;
}

// ─── Two-Factor Alert Event ────────────────────────────────────────────────────

export type TwoFactorAlertEvent = 'enabled' | 'disabled' | 'reset';

// ─── Type-Safe Params Map ──────────────────────────────────────────────────────

export interface TemplateVariableMap {
	auth_account_approval: {
		name: string;
		approvedByName: string;
		appUrl: string;
		year: number;
	};
	auth_invitation: {
		name: string;
		role: RoleTypeEnum;
		createdByName: string;
		appUrl: string;
		year: number;
	};
	auth_magic_link: {
		verificationUrl: string;
		redirectUrl: string;
		expiresInMinutes: number;
		year: number;
	};
	auth_two_factor_alert: {
		name: string;
		event: TwoFactorAlertEvent;
		eventLabel: string;
		ipAddress: string;
		userAgent: string;
		year: number;
	};
	auth_welcome: {
		name: string;
		email: string;
		year: number;
	};
}

// ─── Runtime Registry (variable descriptors per template) ──────────────────────

export const TEMPLATE_REGISTRY: Record<TemplateKey, TemplateVariableDescriptor[]> = {
	[TEMPLATE_KEYS.AUTH_ACCOUNT_APPROVAL]: [
		{ name: 'name', type: 'string', required: true, description: 'Recipient display name (defaults to "there")' },
		{ name: 'approvedByName', type: 'string', required: true, description: 'Name of the admin who approved the account' },
		{ name: 'appUrl', type: 'string', required: true, description: 'Application URL' },
		{ name: 'year', type: 'number', required: true, description: 'Current year for footer copyright' },
	],
	[TEMPLATE_KEYS.AUTH_INVITATION]: [
		{ name: 'name', type: 'string', required: true, description: 'Recipient display name (defaults to "there")' },
		{ name: 'role', type: 'string', required: true, description: 'Assigned role (ADMIN, MANAGER, USER, SUPER_ADMIN)' },
		{ name: 'createdByName', type: 'string', required: true, description: 'Name of the admin who created the invitation' },
		{ name: 'appUrl', type: 'string', required: true, description: 'Application URL' },
		{ name: 'year', type: 'number', required: true, description: 'Current year for footer copyright' },
	],
	[TEMPLATE_KEYS.AUTH_MAGIC_LINK]: [
		{ name: 'verificationUrl', type: 'string', required: true, description: 'Magic link verification URL' },
		{ name: 'redirectUrl', type: 'string', required: true, description: 'URL to redirect after verification' },
		{ name: 'expiresInMinutes', type: 'number', required: true, description: 'Link expiration time in minutes' },
		{ name: 'year', type: 'number', required: true, description: 'Current year for footer copyright' },
	],
	[TEMPLATE_KEYS.AUTH_TWO_FACTOR_ALERT]: [
		{ name: 'name', type: 'string', required: true, description: 'Recipient display name (defaults to "there")' },
		{ name: 'event', type: 'string', required: true, description: '2FA event type: enabled, disabled, or reset' },
		{ name: 'eventLabel', type: 'string', required: true, description: 'Human-readable event label' },
		{ name: 'ipAddress', type: 'string', required: true, description: 'IP address of the action' },
		{ name: 'userAgent', type: 'string', required: true, description: 'User agent of the action' },
		{ name: 'year', type: 'number', required: true, description: 'Current year for footer copyright' },
	],
	[TEMPLATE_KEYS.AUTH_WELCOME]: [
		{ name: 'name', type: 'string', required: true, description: 'Recipient display name (defaults to "there")' },
		{ name: 'email', type: 'string', required: true, description: 'Recipient email address' },
		{ name: 'year', type: 'number', required: true, description: 'Current year for footer copyright' },
	],
};

// ─── Helper: get variables for a template key ──────────────────────────────────

export function getTemplateVariables(key: TemplateKey): TemplateVariableDescriptor[] {
	return TEMPLATE_REGISTRY[key];
}

/**
 * Check if a string is a known template key.
 */
export function isTemplateKey(key: string): key is TemplateKey {
	return key in TEMPLATE_REGISTRY;
}
