import z from 'zod';
import { validateString } from '../../../core/validators/common.schema';

export const twoFactorCodeSchema = z
	.object({
		code: validateString('Two-factor code', { min: 6, max: 32 }),
	})
	.strict();

export type TwoFactorCodeDto = z.infer<typeof twoFactorCodeSchema>;
