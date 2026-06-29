import { badRequestError, forbiddenError } from '../../core/errors/domain-error';
import type { OrgRoleEnum } from './organization.types';

export class OrganizationPolicy {
	static assertIsAdminOrSupervisor(role: OrgRoleEnum | null | undefined): void {
		if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
			throw forbiddenError(
				'insufficient_org_role',
				"You don't have permission. ADMIN or SUPERVISOR role required.",
			);
		}
	}

	static assertIsAdmin(role: OrgRoleEnum | null | undefined): void {
		if (role !== 'ADMIN') {
			throw forbiddenError(
				'insufficient_org_role',
				"You don't have permission. ADMIN role required.",
			);
		}
	}

	static assertNotAddingOwner(memberEmails: string[], ownerEmail: string): void {
		if (memberEmails.map(e => e.toLowerCase()).includes(ownerEmail.toLowerCase())) {
			throw badRequestError('The organization owner cannot be added as a member.');
		}
	}

	static assertNotRemovingSelf(targetUserId: number, currentUserId: number): void {
		if (targetUserId === currentUserId) {
			throw badRequestError('You cannot remove yourself from the organization.');
		}
	}
}
