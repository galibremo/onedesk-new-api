import type { TeamSchemaType, TeamRoleEnum, TeamStatusEnum, TeamMemberStatusEnum } from '../../core/database/types';

export type { TeamRoleEnum, TeamStatusEnum, TeamMemberStatusEnum };

export type TeamManagementRow = Pick<
	TeamSchemaType,
	'id' | 'publicId' | 'name' | 'slug' | 'status' | 'deletedAt' | 'createdAt' | 'updatedAt'
> & {
	memberCount: number;
	ownerId: number | null;
	ownerPublicId: string | null;
	ownerName: string | null;
	ownerEmail: string | null;
};

export type TeamMemberRow = {
	userId: number;
	userPublicId: string;
	userName: string | null;
	userEmail: string;
	userImage: string | null;
	role: TeamRoleEnum;
	status: TeamMemberStatusEnum;
};

export type TeamManagementResponse = {
	id: string;
	name: string;
	slug: string | null;
	status: TeamStatusEnum;
	memberCount: number;
	owner: {
		id: string;
		name: string | null;
		email: string;
	} | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type TeamMemberResponse = {
	userId: string;
	name: string | null;
	email: string;
	image: string | null;
	role: TeamRoleEnum;
	status: TeamMemberStatusEnum;
};

export interface TeamListResponse {
	rows: TeamManagementResponse[];
	total: number;
	page: number;
	pageSize: number;
}

export interface TeamMemberListResponse {
	rows: TeamMemberResponse[];
	total: number;
	page: number;
	pageSize: number;
}

export interface ArchiveTeamResponse {
	archived: boolean;
}

export interface AddMembersResponse {
	added: number;
}

export interface RemoveMembersResponse {
	removed: number;
}
