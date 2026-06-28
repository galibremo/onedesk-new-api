import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export const normalizeRole = (role: string): string => role.toUpperCase().replace(/-/g, '_');

export const isAdminRole = (role?: string | null): boolean => {
	const normalizedRole = role ? normalizeRole(role) : '';

	return normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';
};

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles.map(normalizeRole));
