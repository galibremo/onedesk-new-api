import { Inject, Injectable, Logger } from '@nestjs/common';

import {
	badRequestError,
	conflictError,
	isDatabaseUniqueViolation,
	notFoundError,
} from '../../core/errors/domain-error';
import type { RoleTypeEnum, UserSchemaType } from '../../core/database/types';
import type { UserWithoutPassword } from '../auth/auth.types';
import { InvitationEmail } from '../auth/emails/invitation.email';
import { mapMemberRows, mapOrgToDetails, mapOrgToListItem } from './organization.mapper';
import { OrganizationPolicy } from './organization.policy';
import { ORG_CLOUDINARY_SERVICE } from './organization.providers';
import { OrganizationRepository } from './organization.repository';
import type {
	AddMemberInput,
	MemberFilterQuery,
	OrganizationDetails,
	OrganizationListItem,
	OrganizationMemberItem,
	OrgRoleEnum,
	UploadLogoResponse,
} from './organization.types';
import { CloudinaryImageService } from '../media/services/cloudinary.service';
import type {
	AddMembersDto,
	CreateOrganizationDto,
	MembersListQueryDto,
	RemoveMembersDto,
	UpdateMemberRoleDto,
	UpdateOrganizationDto,
} from './organization.schema';

@Injectable()
export class OrganizationService {
	private readonly logger = new Logger(OrganizationService.name);

	constructor(
		private readonly orgRepository: OrganizationRepository,
		private readonly invitationEmail: InvitationEmail,
		@Inject(ORG_CLOUDINARY_SERVICE)
		private readonly cloudinary: CloudinaryImageService,
	) {}

	async create(
		data: CreateOrganizationDto,
		currentUser: UserWithoutPassword,
	): Promise<OrganizationDetails> {
		const duplicate = await this.orgRepository.findByNameAndOwner(data.name, currentUser.id);
		if (duplicate) {
			throw conflictError('org_name_taken', 'You already have an organization with this name.');
		}

		const slug = await this.generateUniqueSlug(data.name);

		// TODO: create subscription for planId when subscription module is migrated

		try {
			const org = await this.orgRepository.create({
				name: data.name,
				slug,
				ownerId: currentUser.id,
			});

			return mapOrgToDetails(org, currentUser.publicId);
		} catch (error) {
			if (isDatabaseUniqueViolation(error)) {
				throw conflictError('org_name_taken', 'You already have an organization with this name.');
			}
			throw error;
		}
	}

	async getList(currentUser: UserWithoutPassword): Promise<OrganizationListItem[]> {
		const [ownedOrgs, invitedRows] = await Promise.all([
			this.orgRepository.findOwnedOrgs(currentUser.id),
			this.orgRepository.findInvitedOrgs(currentUser.id),
		]);

		const owned = ownedOrgs.map(org =>
			mapOrgToListItem(org, currentUser.publicId, 'ADMIN', 'OWNED'),
		);

		const invited = invitedRows.map(({ org, member }) =>
			mapOrgToListItem(org, currentUser.publicId, member.role, 'INVITED'),
		);

		return [...owned, ...invited];
	}

	async getOne(orgPublicId: string, currentUser: UserWithoutPassword): Promise<OrganizationDetails> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw notFoundError('org_not_found', 'Organization not found.');
		}

		const isOwner = org.ownerId === currentUser.id;
		if (!isOwner) {
			const member = await this.orgRepository.findMember(org.id, currentUser.id);
			if (!member || member.status === 'INACTIVE') {
				throw notFoundError('org_not_found', 'Organization not found.');
			}
		}

		return mapOrgToDetails(org, currentUser.publicId);
	}

	async update(
		orgPublicId: string,
		currentUser: UserWithoutPassword,
		data: UpdateOrganizationDto,
	): Promise<OrganizationDetails> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw notFoundError('org_not_found', 'Organization not found.');
		}

		const duplicate = await this.orgRepository.findByNameAndOwner(
			data.name,
			org.ownerId,
			org.id,
		);
		if (duplicate) {
			throw conflictError('org_name_taken', 'You already have an organization with this name.');
		}

		const updated = await this.orgRepository.update(org.id, {
			name: data.name,
			description: data.description ?? null,
			industry: data.industry ?? null,
		});

		return mapOrgToDetails(updated!, currentUser.publicId);
	}

	async uploadLogo(
		orgPublicId: string,
		currentUser: UserWithoutPassword,
		file: Express.Multer.File,
	): Promise<UploadLogoResponse> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw notFoundError('org_not_found', 'Organization not found.');
		}

		const result = await this.cloudinary.uploadFromBuffer(file.buffer);
		if (!result.success || !result.data) {
			throw badRequestError(result.error ?? 'Logo upload failed.');
		}

		const { secure_url: logo, public_id: logoPublicId } = result.data;

		if (org.logoPublicId) {
			this.cloudinary.deleteMedia(org.logoPublicId).catch(err => {
				this.logger.warn(`Failed to delete old org logo: ${(err as Error).message}`);
			});
		}

		await this.orgRepository.updateLogo(org.id, logo, logoPublicId);

		return { logo };
	}

	async getMembers(orgPublicId: string): Promise<OrganizationMemberItem[]> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw notFoundError('org_not_found', 'Organization not found.');
		}

		const rows = await this.orgRepository.findAllMembers(org.id);
		return mapMemberRows(rows);
	}

	async getMembersList(
		orgPublicId: string,
		filter: MembersListQueryDto,
	): Promise<{ members: OrganizationMemberItem[]; total: number; page: number; limit: number }> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw notFoundError('org_not_found', 'Organization not found.');
		}

		const query: MemberFilterQuery = {
			page: filter.page,
			limit: filter.limit,
			sortBy: filter.sortBy,
			sortOrder: filter.sortOrder,
			search: filter.search,
			roleQuery: filter.roleQuery,
			teamIdQuery: filter.teamIdQuery,
		};

		const { rows, total } = await this.orgRepository.findMembersPaginated(org.id, query);

		return {
			members: mapMemberRows(rows),
			total,
			page: filter.page ?? 1,
			limit: filter.limit ?? 20,
		};
	}

	async addMembers(
		orgPublicId: string,
		currentUser: UserWithoutPassword,
		data: AddMembersDto,
	): Promise<{ added: number }> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw notFoundError('org_not_found', 'Organization not found.');
		}

		// TODO: validate subscription and enforce member limit when subscription module is migrated

		const memberEmails = data.members.map(m => m.email);
		OrganizationPolicy.assertNotAddingOwner(memberEmails, currentUser.email);

		const resolvedMembers: AddMemberInput[] = [];

		await this.orgRepository.transaction(async tx => {
			for (const memberInput of data.members) {
				let user: UserSchemaType | undefined;

				user = await this.orgRepository.findUserByEmail(memberInput.email);

				if (!user) {
					try {
						user = await this.orgRepository.createStubUser(memberInput.email, tx);
					} catch (error) {
						if (isDatabaseUniqueViolation(error)) {
							user = await this.orgRepository.findUserByEmail(memberInput.email);
						} else {
							throw error;
						}
					}
				}

				if (!user) continue;

				await this.orgRepository.upsertMember(
					{ userId: user.id, organizationId: org.id, role: memberInput.role },
					tx,
				);

				resolvedMembers.push({ email: user.email, role: memberInput.role });
			}
		});

		// TODO: call InvitationService.createMemberInvitation() for each member once InvitationModule is migrated

		for (const member of resolvedMembers) {
			this.invitationEmail
				.send({
					email: member.email,
					role: member.role as unknown as RoleTypeEnum,
					createdByName: currentUser.name,
				})
				.catch(err => {
					this.logger.warn(
						`Failed to send invitation email to ${member.email}: ${(err as Error).message}`,
					);
				});
		}

		return { added: resolvedMembers.length };
	}

	async updateMemberRole(
		orgPublicId: string,
		currentUser: UserWithoutPassword,
		data: UpdateMemberRoleDto,
	): Promise<void> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw notFoundError('org_not_found', 'Organization not found.');
		}

		const targetUser = await this.orgRepository.findUserByPublicId(data.userId);
		if (!targetUser) {
			throw notFoundError('user_not_found', 'User not found.');
		}

		if (targetUser.id === org.ownerId) {
			throw badRequestError("The organization owner's role cannot be changed.");
		}

		const member = await this.orgRepository.findMember(org.id, targetUser.id);
		if (!member) {
			throw notFoundError('member_not_found', 'This user is not a member of the organization.');
		}

		await this.orgRepository.updateMemberRole(org.id, targetUser.id, data.role as OrgRoleEnum);
	}

	async removeMembers(
		orgPublicId: string,
		currentUser: UserWithoutPassword,
		data: RemoveMembersDto,
	): Promise<void> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw notFoundError('org_not_found', 'Organization not found.');
		}

		const targetUsers = await Promise.all(
			data.members.map(m => this.orgRepository.findUserByPublicId(m.userId)),
		);

		const validUsers = targetUsers.filter((u): u is NonNullable<typeof u> => !!u);
		const userIds = validUsers.map(u => u.id).filter(id => id !== org.ownerId);

		if (userIds.length === 0) return;

		await this.orgRepository.removeMembers(org.id, userIds);

		// TODO: call InvitationService.removeMemberInvitation() for each user once InvitationModule is migrated
	}

	async getUserRoleInOrg(orgPublicId: string, userId: number): Promise<OrgRoleEnum | null> {
		const org = await this.orgRepository.findByPublicId(orgPublicId);
		if (!org) return null;

		if (org.ownerId === userId) return 'ADMIN';

		const member = await this.orgRepository.findMember(org.id, userId);
		if (!member || member.status === 'INACTIVE') return null;

		return member.role;
	}

	private async generateUniqueSlug(name: string): Promise<string> {
		const base = name
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '');

		let slug = base;
		let counter = 1;

		while (await this.orgRepository.slugExists(slug)) {
			slug = `${base}-${counter}`;
			counter++;
		}

		return slug;
	}
}
