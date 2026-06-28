import { z } from 'zod';

import { baseQuerySchema, type SortableField } from '../../../core/validators/base-query.schema';
import { validateEnum } from '../../../core/validators/common.schema';

const EMAIL_TEMPLATE_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'key', queryName: 'key' },
	{ name: 'subject', queryName: 'subject' },
	{ name: 'version', queryName: 'version' },
	{ name: 'isActive', queryName: 'isActive' },
	{ name: 'createdAt', queryName: 'createdAt' },
	{ name: 'updatedAt', queryName: 'updatedAt' },
] as const;

const isActiveQuerySchema = z
	.preprocess(
		value => {
			const rawValue = Array.isArray(value) ? (value[0] as unknown) : value;
			if (typeof rawValue !== 'string') return undefined;

			const normalized = rawValue.trim().toLowerCase();
			return normalized || undefined;
		},
		validateEnum('Is Active', ['true', 'false']).optional(),
	)
	.transform(value => (value === undefined ? undefined : value === 'true'));

export const emailTemplateListQuerySchema = baseQuerySchema(
	EMAIL_TEMPLATE_SORTABLE_FIELDS,
).safeExtend({
	isActive: isActiveQuerySchema,
});

export type EmailTemplateListQueryDto = z.infer<typeof emailTemplateListQuerySchema>;
