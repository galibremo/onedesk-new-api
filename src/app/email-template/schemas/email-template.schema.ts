import { z } from 'zod';

import { validateString } from '../../../core/validators/common.schema';

export const updateEmailTemplateSchema = z
	.object({
		subject: validateString('Subject').optional(),
		html: validateString('HTML').optional(),
		text: validateString('Text').optional(),
		isActive: z.boolean().optional(),
	})
	.strict()
	.refine(data => Object.keys(data).length > 0, {
		message: 'At least one field must be provided',
	});

export type UpdateEmailTemplateDto = z.infer<typeof updateEmailTemplateSchema>;
