import type { UserSchemaType } from '../../core/database/types';
import { forbiddenError } from '../../core/errors/domain-error';

type UserActor = Pick<UserSchemaType, 'id' | 'role'>;

export class TeamPolicy {
	static assertCanCreateTeam(actor: UserActor): void {
		return;
	}

	static assertCanManageTeam(actor: UserActor, teamOwnerId: number | null): void {
		if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN') return;

		if (teamOwnerId && actor.id === teamOwnerId) return;

		throw forbiddenError('forbidden', 'You do not have permission to manage this team.');
	}

	static assertCanAddMember(targetUser: UserActor): void {
		if (targetUser.role === 'SUPER_ADMIN') {
			throw forbiddenError('forbidden', 'Super Admin users cannot be added as team members.');
		}
	}
}
