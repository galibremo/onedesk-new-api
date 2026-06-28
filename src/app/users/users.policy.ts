import type { RoleTypeEnum, UserSchemaType } from '../../core/database/types';
import { forbiddenError } from '../../core/errors/domain-error';

type UserActor = Pick<UserSchemaType, 'id' | 'role'>;

const manageableByAdmin = new Set<RoleTypeEnum>(['USER', 'MANAGER']);

export class UsersPolicy {
	static assertCanManageUser(actor: UserActor, target: UserActor): void {
		if (actor.id === target.id) {
			throw forbiddenError('forbidden', 'You cannot manage your own user account here.');
		}

		if (actor.role === 'SUPER_ADMIN') return;

		if (actor.role === 'ADMIN' && manageableByAdmin.has(target.role)) return;

		throw forbiddenError('forbidden', "You don't have permission to manage this user.");
	}

	static assertCanAssignRole(actor: UserActor, role: RoleTypeEnum): void {
		if (actor.role === 'SUPER_ADMIN') return;

		if (actor.role === 'ADMIN' && manageableByAdmin.has(role)) return;

		throw forbiddenError('forbidden', "You don't have permission to assign this role.");
	}
}
