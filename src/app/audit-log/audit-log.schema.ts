import { z } from 'zod';

import { baseQuerySchema, type SortableField } from '../../core/validators/base-query.schema';
import { validateString, validateUUID } from '../../core/validators/common.schema';

const AUDIT_LOG_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'action', queryName: 'action' },
	{ name: 'actorRole', queryName: 'actorRole' },
	{ name: 'targetType', queryName: 'targetType' },
	{ name: 'targetId', queryName: 'targetId' },
	{ name: 'createdAt', queryName: 'createdAt' },
	{ name: 'updatedAt', queryName: 'updatedAt' },
] as const;

export const auditLogListQuerySchema = baseQuerySchema(AUDIT_LOG_SORTABLE_FIELDS).safeExtend({
	actorId: validateUUID('Actor ID').optional(),
	actor: validateString('Actor', { max: 255 }).optional(),
	action: validateString('Action', { max: 100 }).optional(),
	targetType: validateString('Target Type', { max: 50 }).optional(),
});

export type AuditLogListQueryDto = z.infer<typeof auditLogListQuerySchema>;
