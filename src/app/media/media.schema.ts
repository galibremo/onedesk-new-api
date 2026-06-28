import z from 'zod';
import { validateString } from '../../core/validators/common.schema';
import { baseQuerySchema, type SortableField } from '../../core/validators/base-query.schema';

export const mediaSchema = z
	.object({
		name: validateString('Media Name'),
		altText: validateString('Media Alt Text'),
	})
	.strict();

export type MediaDto = z.infer<typeof mediaSchema>;

export const MEDIA_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'filename', queryName: 'filename' },
	{ name: 'fileSize', queryName: 'fileSize' },
	{ name: 'createdAt', queryName: 'createdAt' },
	{ name: 'updatedAt', queryName: 'updatedAt' },
] as const;

export const mediaListQuerySchema = baseQuerySchema(MEDIA_SORTABLE_FIELDS).safeExtend({
	mediaType: validateString('Media Type').optional(),
});

export type MediaListQueryDto = z.infer<typeof mediaListQuerySchema>;
