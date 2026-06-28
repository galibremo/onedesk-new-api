import type { SessionSchemaType } from '../../../core/database/types';
import type { SessionResponse, SessionStatus } from './session.types';

export function mapSessionResponse(
	session: SessionSchemaType,
	currentSessionToken?: string,
	now: Date = new Date(),
): SessionResponse {
	return {
		id: session.publicId,
		deviceName: session.deviceName ?? 'Unknown Device',
		deviceType: session.deviceType ?? 'Unknown',
		ipAddress: session.ipAddress ?? 'Unknown',
		userAgent: session.userAgent ?? 'Unknown',
		status: getSessionStatus(session, now),
		isCurrent: !!currentSessionToken && session.token === currentSessionToken,
		isRevoked: session.isRevoked,
		twoFactorVerified: session.twoFactorVerified,
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		expiresAt: session.expiresAt,
	};
}

function getSessionStatus(
	session: Pick<SessionSchemaType, 'expiresAt' | 'isRevoked'>,
	now: Date,
): SessionStatus {
	if (session.isRevoked) return 'revoked';
	if (session.expiresAt < now) return 'expired';
	return 'active';
}
