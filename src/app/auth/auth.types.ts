import type { UserSchemaType } from '../../core/database/types';

export type UserWithoutPassword = Omit<UserSchemaType, 'password' | 'twoFactorSecretEncrypted'> & {
	hasPassword: boolean;
};

export const dashboardAccessRestrictionCodes = [
	'account_pending_approval',
	'dashboard_role_not_allowed',
] as const;

export type DashboardAccessRestrictionCode = (typeof dashboardAccessRestrictionCodes)[number];

export interface DashboardAccessRestriction {
	code: DashboardAccessRestrictionCode;
	message: string;
}

export type CreateUser = Omit<
	UserSchemaType,
	'id' | 'publicId' | 'is2faEnabled' | 'twoFactorSecretEncrypted' | 'createdAt' | 'updatedAt'
>;

// Api Response Types
export type UserWithoutPasswordResponse = Omit<
	UserSchemaType,
	'id' | 'publicId' | 'password' | 'twoFactorSecretEncrypted'
> & { id: string; hasPassword: boolean };

export interface UserInformation {
	userId: number;
	email: string;
	userAgent: string;
	ipAddress: string;
	deviceName: string;
	deviceType: string;
	expirationTime?: number;
}

export interface MagicLinkSessionInfo {
	userAgent: string;
	ipAddress: string;
	deviceName: string;
	deviceType: string;
}

export interface VerifiedGoogleProfile {
	email: string;
	name: string | null;
	picture: string | null;
	googleId: string;
	emailVerified: boolean;
}
