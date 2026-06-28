import z from 'zod';
import {
	validateEmail,
	validatePassword,
	validateString,
} from '../../../core/validators/common.schema';

export const passwordLoginSchema = z
	.object({
		email: validateEmail,
		password: validatePassword,
	})
	.strict();

export const setPasswordSchema = z
	.object({
		password: validatePassword,
	})
	.strict();

export const changePasswordSchema = z
	.object({
		currentPassword: validateString('Current password'),
		newPassword: validatePassword,
	})
	.strict();

export type PasswordLoginDto = z.infer<typeof passwordLoginSchema>;
export type SetPasswordDto = z.infer<typeof setPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
