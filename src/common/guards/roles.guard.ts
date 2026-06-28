import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { isAdminRole, normalizeRole, ROLES_KEY } from '../decorators/roles.decorator';
import { forbiddenError } from '../../core/errors/domain-error';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles?.length) {
			return true;
		}

		const contextType = context.getType();
		if (contextType !== 'http') {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();
		const userRole = request.user?.role;

		if (!userRole) {
			throw forbiddenError('role_required', 'Role information is required.');
		}

		const normalizedUserRole = normalizeRole(userRole);

		if (
			!requiredRoles.includes(normalizedUserRole) &&
			!(requiredRoles.includes('ADMIN') && isAdminRole(normalizedUserRole))
		) {
			throw forbiddenError('forbidden', "You don't have permission to access this resource.");
		}

		return true;
	}
}
