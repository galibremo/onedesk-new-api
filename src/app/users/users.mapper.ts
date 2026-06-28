import type { UserManagementResponse, UserManagementRow } from './users.types';

export function mapUserManagementResponse(row: UserManagementRow): UserManagementResponse {
	return {
		id: row.publicId,
		name: row.name,
		email: row.email,
		image: row.image,
		phone: row.phone,
		emailVerified: row.emailVerified,
		is2faEnabled: row.is2faEnabled,
		role: row.role,
		isApproved: row.isApproved,
		activeSessionCount: Number(row.activeSessionCount ?? 0),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
