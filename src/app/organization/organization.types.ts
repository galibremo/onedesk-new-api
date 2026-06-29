import type { OrgMemberStatusEnum, OrgRoleEnum } from '../../core/database/types';

export type { OrgRoleEnum, OrgMemberStatusEnum };

export interface OrganizationListItem {
	id: string;
	name: string;
	slug: string | null;
	logo: string | null;
	ownerId: string;
	numberOfTeams: number;
	numberOfChannels: number;
	role: OrgRoleEnum;
	tag: 'OWNED' | 'INVITED';
}

export interface OrganizationDetails {
	id: string;
	name: string;
	slug: string | null;
	description: string | null;
	logo: string | null;
	industry: string | null;
	ownerId: string;
	createdAt: Date;
}

export interface OrganizationMemberItem {
	id: string;
	image: string | null;
	name: string | null;
	email: string;
	organizationRole: OrgRoleEnum;
	teams: { id: string; name: string }[];
	emailVerified: boolean;
	joinedDate: Date | null;
}

export interface MemberFilterQuery {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: 'ASC' | 'DESC';
	search?: string;
	roleQuery?: string;
	teamIdQuery?: string;
}

export interface AddMemberInput {
	email: string;
	role: OrgRoleEnum;
}

export interface UploadLogoResponse {
	logo: string;
}

export interface OwnedOrgRow {
	id: number;
	publicId: string;
	name: string;
	slug: string | null;
	logo: string | null;
	industry: string | null;
	description: string | null;
	ownerId: number;
	ownerPublicId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface MemberWithUserRow {
	memberId: number;
	memberPublicId: string;
	role: OrgRoleEnum;
	status: OrgMemberStatusEnum;
	joinedAt: Date | null;
	userId: number;
	userPublicId: string;
	userName: string | null;
	userEmail: string;
	userImage: string | null;
	emailVerified: boolean;
}
