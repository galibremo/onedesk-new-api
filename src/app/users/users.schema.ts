import { z } from 'zod';

import { baseQuerySchema, type SortableField } from '../../core/validators/base-query.schema';
import {
	validateBoolean,
	validateEmail,
	validateEnum,
	validatePassword,
	validatePhoneNumber,
	validateString,
} from '../../core/validators/common.schema';
import { roleTypeEnum } from '../../core/database/schema/enum.schema';

export const userRoleValues = roleTypeEnum.enumValues;

const USER_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'name', queryName: 'name' },
	{ name: 'email', queryName: 'email' },
	{ name: 'emailVerified', queryName: 'emailVerified' },
	{ name: 'is2faEnabled', queryName: 'is2faEnabled' },
	{ name: 'role', queryName: 'role' },
	{ name: 'isApproved', queryName: 'isApproved' },
	{ name: 'activeSessionCount', queryName: 'activeSessionCount' },
	{ name: 'createdAt', queryName: 'createdAt' },
	{ name: 'updatedAt', queryName: 'updatedAt' },
] as const;

const roleQuerySchema = validateString('Role')
	.transform(value =>
		value
			.split(',')
			.map(role => role.trim())
			.filter(Boolean),
	)
	.refine(
		values =>
			values.every(role => userRoleValues.includes(role as (typeof userRoleValues)[number])),
		{ message: 'Role is invalid' },
	)
	.transform(values => values as (typeof userRoleValues)[number][])
	.optional();

const emailVerifiedQuerySchema = z
	.preprocess(
		value => {
			const rawValue = Array.isArray(value) ? (value[0] as unknown) : value;
			if (typeof rawValue !== 'string') return undefined;

			const normalized = rawValue.trim().toLowerCase();
			return normalized || undefined;
		},
		validateEnum('Email Verified', ['true', 'false']).optional(),
	)
	.transform(value => (value === undefined ? undefined : value === 'true'));

const isApprovedQuerySchema = z
	.preprocess(
		value => {
			const rawValue = Array.isArray(value) ? (value[0] as unknown) : value;
			if (typeof rawValue !== 'string') return undefined;

			const normalized = rawValue.trim().toLowerCase();
			return normalized || undefined;
		},
		validateEnum('Is Approved', ['true', 'false']).optional(),
	)
	.transform(value => (value === undefined ? undefined : value === 'true'));

export const usersListQuerySchema = baseQuerySchema(USER_SORTABLE_FIELDS).safeExtend({
	role: roleQuerySchema,
	emailVerified: emailVerifiedQuerySchema,
	isApproved: isApprovedQuerySchema,
});

export const updateUserRoleSchema = z
	.object({
		role: validateEnum('Role', userRoleValues),
	})
	.strict();

const optionalNullableString = (name: string, max = 255) =>
	z.preprocess(value => {
		if (value === null) return null;
		if (typeof value !== 'string') return undefined;

		const trimmed = value.trim();
		return trimmed || null;
	}, validateString(name, { max }).nullable().optional());

const optionalNullablePhone = z.preprocess(value => {
	if (value === null) return null;
	if (typeof value !== 'string') return undefined;

	const trimmed = value.trim();
	return trimmed || null;
}, validatePhoneNumber('Phone').nullable().optional());

const optionalNullablePassword = z.preprocess(value => {
	if (value === null) return null;
	if (typeof value !== 'string') return undefined;

	const trimmed = value.trim();
	return trimmed || null;
}, validatePassword.nullable().optional());

export const createUserSchema = z
	.object({
		name: optionalNullableString('Name'),
		email: validateEmail.transform(value => value.toLowerCase()),
		password: optionalNullablePassword,
		phone: optionalNullablePhone,
		emailVerified: validateBoolean('Email Verified').optional(),
		role: validateEnum('Role', userRoleValues),
		isApproved: validateBoolean('Is Approved').optional(),
	})
	.strict();

export const updateUserSchema = z
	.object({
		name: optionalNullableString('Name'),
		email: validateEmail.transform(value => value.toLowerCase()).optional(),
		phone: optionalNullablePhone,
		emailVerified: validateBoolean('Email Verified').optional(),
		isApproved: validateBoolean('Is Approved').optional(),
	})
	.strict()
	.refine(data => Object.keys(data).length > 0, {
		message: 'At least one user field must be provided',
	});

export type UsersListQueryDto = z.infer<typeof usersListQuerySchema>;
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleDto = z.infer<typeof updateUserRoleSchema>;
