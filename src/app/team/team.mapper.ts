import type {
	TeamManagementResponse,
	TeamManagementRow,
	TeamMemberResponse,
	TeamMemberRow,
} from './team.types';

export function mapTeamManagementResponse(row: TeamManagementRow): TeamManagementResponse {
	return {
		id: row.publicId,
		name: row.name,
		slug: row.slug,
		status: row.status,
		memberCount: Number(row.memberCount ?? 0),
		owner:
			row.ownerId != null && row.ownerPublicId != null && row.ownerEmail != null
				? {
						id: row.ownerPublicId,
						name: row.ownerName,
						email: row.ownerEmail,
					}
				: null,
		deletedAt: row.deletedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function mapTeamMemberResponse(row: TeamMemberRow): TeamMemberResponse {
	return {
		userId: row.userPublicId,
		name: row.userName,
		email: row.userEmail,
		image: row.userImage,
		role: row.role,
		status: row.status,
	};
}
