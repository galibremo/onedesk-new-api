import { z } from 'zod';

export const createOrganizationSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255).trim(),
	planId: z.number().int().positive('Plan ID must be a positive integer'),
});

export const updateOrganizationSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255).trim(),
	industry: z.string().max(255).optional(),
	description: z.string().max(1000).optional(),
});

export const addMembersSchema = z.object({
	members: z
		.array(
			z.object({
				email: z.string().email('Invalid email address'),
				role: z.enum(['ADMIN', 'SUPERVISOR', 'AGENT']),
			}),
		)
		.min(1, 'At least one member is required'),
});

export const removeMembersSchema = z.object({
	members: z
		.array(
			z.object({
				userId: z.string().uuid('Invalid user ID'),
			}),
		)
		.min(1, 'At least one member is required'),
});

export const updateMemberRoleSchema = z.object({
	userId: z.string().uuid('Invalid user ID'),
	role: z.enum(['ADMIN', 'SUPERVISOR', 'AGENT']),
});

export const membersListQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
	sortBy: z.string().optional(),
	sortOrder: z.enum(['ASC', 'DESC']).optional(),
	search: z.string().optional(),
	roleQuery: z.string().optional(),
	teamIdQuery: z.string().optional(),
});

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;
export type AddMembersDto = z.infer<typeof addMembersSchema>;
export type RemoveMembersDto = z.infer<typeof removeMembersSchema>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
export type MembersListQueryDto = z.infer<typeof membersListQuerySchema>;
