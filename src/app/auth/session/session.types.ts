import type { SessionSchemaType } from '../../../core/database/types';

export type SessionDataType = Omit<
	SessionSchemaType,
	| 'id'
	| 'publicId'
	| 'twoFactorVerified'
	| 'twoFactorFailedAttempts'
	| 'twoFactorLockedUntil'
	| 'isRevoked'
	| 'createdAt'
	| 'updatedAt'
>;

export type SessionStatus = 'active' | 'revoked' | 'expired';

export type SessionSortKey =
	| 'deviceName'
	| 'deviceType'
	| 'ipAddress'
	| 'userAgent'
	| 'status'
	| 'createdAt'
	| 'expiresAt';

export type SessionSortDirection = 'asc' | 'desc';

export type SessionResponse = Pick<
	SessionSchemaType,
	'isRevoked' | 'twoFactorVerified' | 'createdAt' | 'updatedAt' | 'expiresAt'
> & {
	id: string;
	deviceName: string;
	deviceType: string;
	ipAddress: string;
	userAgent: string;
	status: SessionStatus;
	isCurrent: boolean;
};

export interface SessionListResponse {
	rows: SessionResponse[];
	total: number;
	page: number;
	pageSize: number;
	activeOtherSessionCount: number;
}
