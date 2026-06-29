import type { OrganizationSchemaType } from '../../core/database/types';
import type {
	MemberWithUserRow,
	OrgRoleEnum,
	OrganizationDetails,
	OrganizationListItem,
	OrganizationMemberItem,
} from './organization.types';

export function mapOrgToListItem(
	org: OrganizationSchemaType,
	ownerPublicId: string,
	role: OrgRoleEnum,
	tag: 'OWNED' | 'INVITED',
): OrganizationListItem {
	return {
		id: org.publicId,
		name: org.name,
		slug: org.slug,
		logo: org.logo,
		ownerId: ownerPublicId,
		numberOfTeams: 0, // TODO: populate when team module is migrated
		numberOfChannels: 0, // TODO: populate when channel-org link is added
		role,
		tag,
	};
}

export function mapOrgToDetails(
	org: OrganizationSchemaType,
	ownerPublicId: string,
): OrganizationDetails {
	return {
		id: org.publicId,
		name: org.name,
		slug: org.slug,
		description: org.description,
		logo: org.logo,
		industry: org.industry,
		ownerId: ownerPublicId,
		createdAt: org.createdAt,
	};
}

export function mapMemberRows(rows: MemberWithUserRow[]): OrganizationMemberItem[] {
	return rows.map(row => ({
		id: row.userPublicId,
		image: row.userImage,
		name: row.userName,
		email: row.userEmail,
		organizationRole: row.role,
		teams: [], // TODO: populate when team module is migrated
		emailVerified: row.emailVerified,
		joinedDate: row.joinedAt,
	}));
}
