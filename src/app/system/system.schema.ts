import { z } from 'zod';
import { validateEnum } from '../../core/validators/common.schema';
import { roleTypeEnum } from '../../core/database/schema/enum.schema';

export const updateSystemSettingsSchema = z
	.object({
		accessModel: validateEnum('Access Model', ['OPEN', 'APPROVAL_BASED', 'CLOSED']).optional(),
		allowedRoles: z.array(validateEnum('Role', roleTypeEnum.enumValues)).optional(),
	})
	.strict()
	.refine(data => Object.keys(data).length > 0, {
		message: 'At least one field must be provided to update',
	});

export type UpdateSystemSettingsDto = z.infer<typeof updateSystemSettingsSchema>;
