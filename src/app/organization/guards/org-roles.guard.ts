import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { badRequestError, forbiddenError } from '../../../core/errors/domain-error';
import { OrganizationRepository } from '../organization.repository';
import type { OrgRoleEnum } from '../organization.types';

export const ORG_ROLES_KEY = 'org_roles';

export const OrgRoles = (...roles: OrgRoleEnum[]) => {
	const { SetMetadata } = require('@nestjs/common');
	return SetMetadata(ORG_ROLES_KEY, roles);
};

@Injectable()
export class OrgRolesGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly organizationRepository: OrganizationRepository,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const requiredRoles = this.reflector.getAllAndOverride<OrgRoleEnum[]>(ORG_ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles?.length) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();
		const currentUser = request.user;

		if (!currentUser) {
			throw forbiddenError('unauthorized', 'Authentication is required.');
		}

		const orgPublicId = request.headers['x-organization-id'] as string | undefined;
		if (!orgPublicId) {
			throw badRequestError('x-organization-id header is required for this endpoint.');
		}

		const org = await this.organizationRepository.findByPublicId(orgPublicId);
		if (!org) {
			throw badRequestError('Organization not found.');
		}

		// Owner is implicitly ADMIN
		if (org.ownerId === currentUser.id) {
			return requiredRoles.includes('ADMIN') || requiredRoles.includes('SUPERVISOR');
		}

		const member = await this.organizationRepository.findMember(org.id, currentUser.id);
		if (!member || member.status === 'INACTIVE') {
			throw forbiddenError('not_org_member', 'You are not a member of this organization.');
		}

		if (!requiredRoles.includes(member.role)) {
			throw forbiddenError(
				'insufficient_org_role',
				`This action requires one of the following roles: ${requiredRoles.join(', ')}.`,
			);
		}

		// Attach org and member info to request for use in controllers/services
		(request as Request & { currentOrg?: typeof org; currentOrgMember?: typeof member }).currentOrg =
			org;
		(
			request as Request & {
				currentOrg?: typeof org;
				currentOrgMember?: typeof member;
			}
		).currentOrgMember = member;

		return true;
	}
}
