import z from 'zod';
import { validateEnum, validateString } from '../../../core/validators/common.schema';
import { baseQuerySchema, type SortableField } from '../../../core/validators/base-query.schema';

export const sessionStatusValues = ['active', 'revoked', 'expired'] as const;
const SESSION_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'deviceName', queryName: 'deviceName' },
	{ name: 'deviceType', queryName: 'deviceType' },
	{ name: 'ipAddress', queryName: 'ipAddress' },
	{ name: 'userAgent', queryName: 'userAgent' },
	{ name: 'status', queryName: 'status' },
	{ name: 'createdAt', queryName: 'createdAt' },
	{ name: 'expiresAt', queryName: 'expiresAt' },
] as const;

export const sessionListQuerySchema = baseQuerySchema(SESSION_SORTABLE_FIELDS).safeExtend({
	status: validateString('Status')
		.transform(val => {
			if (!val?.trim()) return [];
			return val
				.split(',')
				.map(v => v.trim())
				.filter(Boolean)
				.map(v => validateEnum('Status', sessionStatusValues).parse(v));
		})
		.optional(),
	deviceType: validateString('Device Type')
		.transform(val => {
			if (!val?.trim()) return [];
			return val
				.split(',')
				.map(v => v.trim())
				.filter(Boolean);
		})
		.optional(),
});

export type SessionListQueryDto = z.infer<typeof sessionListQuerySchema>;
