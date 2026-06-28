import { z } from 'zod';

import { baseQuerySchema, type SortableField } from '../../core/validators/base-query.schema';
import { validateString } from '../../core/validators/common.schema';

const EMAIL_LOG_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'toEmail', queryName: 'toEmail' },
	{ name: 'status', queryName: 'status' },
	{ name: 'templateKey', queryName: 'templateKey' },
	{ name: 'createdAt', queryName: 'createdAt' },
] as const;

export const emailLogsListQuerySchema = baseQuerySchema(EMAIL_LOG_SORTABLE_FIELDS).safeExtend({
	providerId: validateString('Provider ID', { max: 100 }).optional(),
	toEmail: validateString('To Email', { max: 255 }).optional(),
	status: validateString('Status', { max: 20 }).optional(),
	templateKey: validateString('Template Key', { max: 100 }).optional(),
});

export type EmailLogsListQueryDto = z.infer<typeof emailLogsListQuerySchema>;
