import { z } from 'zod';

import { baseQuerySchema, type SortableField } from '../../core/validators/base-query.schema';
import {
	validateArray,
	validateEnum,
	validateString,
	validateUUID,
} from '../../core/validators/common.schema';
import { teamRoleEnum } from '../../core/database/schema/auth.schema';
import { teamStatusEnum } from '../../core/database/schema/team.schema';

export const teamRoleValues = teamRoleEnum.enumValues;
export const teamStatusValues = teamStatusEnum.enumValues;

const TEAM_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'name', queryName: 'name' },
	{ name: 'status', queryName: 'status' },
	{ name: 'createdAt', queryName: 'createdAt' },
	{ name: 'updatedAt', queryName: 'updatedAt' },
] as const;

const TEAM_MEMBER_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'name', queryName: 'name' },
	{ name: 'email', queryName: 'email' },
	{ name: 'role', queryName: 'role' },
	{ name: 'status', queryName: 'status' },
] as const;

const statusQuerySchema = validateString('Status')
	.transform(value =>
		value
			.split(',')
			.map(s => s.trim())
			.filter(Boolean),
	)
	.refine(
		values => values.every(s => (teamStatusValues as readonly string[]).includes(s)),
		{ message: 'Status is invalid' },
	)
	.transform(values => values as (typeof teamStatusValues)[number][])
	.optional();

const roleQuerySchema = validateString('Role')
	.transform(value =>
		value
			.split(',')
			.map(r => r.trim())
			.filter(Boolean),
	)
	.refine(
		values => values.every(r => (teamRoleValues as readonly string[]).includes(r)),
		{ message: 'Role is invalid' },
	)
	.transform(values => values as (typeof teamRoleValues)[number][])
	.optional();

export const teamListQuerySchema = baseQuerySchema(TEAM_SORTABLE_FIELDS).safeExtend({
	status: statusQuerySchema,
});

export const teamMemberListQuerySchema = baseQuerySchema(TEAM_MEMBER_SORTABLE_FIELDS).safeExtend({
	role: roleQuerySchema,
});

export const createTeamSchema = z
	.object({
		name: validateString('Team name', { min: 1, max: 255 }),
		memberIds: validateArray('Member IDs', validateUUID('User ID')).optional(),
	})
	.strict();

export const updateTeamSchema = z
	.object({
		name: validateString('Team name', { min: 1, max: 255 }).optional(),
		status: validateEnum('Status', teamStatusValues).optional(),
	})
	.strict()
	.refine(data => Object.keys(data).length > 0, {
		message: 'At least one field must be provided',
	});

export const addTeamMembersSchema = z
	.object({
		members: validateArray(
			'Members',
			z
				.object({
					userId: validateUUID('User ID'),
					role: validateEnum('Role', teamRoleValues),
				})
				.strict(),
			{ min: 1, max: 100 },
		),
	})
	.strict();

export const removeTeamMembersSchema = z
	.object({
		memberIds: validateArray('Member IDs', validateUUID('User ID'), { min: 1, max: 100 }),
	})
	.strict();

export const updateMemberRoleSchema = z
	.object({
		role: validateEnum('Role', teamRoleValues),
	})
	.strict();

export type TeamListQueryDto = z.infer<typeof teamListQuerySchema>;
export type TeamMemberListQueryDto = z.infer<typeof teamMemberListQuerySchema>;
export type CreateTeamDto = z.infer<typeof createTeamSchema>;
export type UpdateTeamDto = z.infer<typeof updateTeamSchema>;
export type AddTeamMembersDto = z.infer<typeof addTeamMembersSchema>;
export type RemoveTeamMembersDto = z.infer<typeof removeTeamMembersSchema>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
