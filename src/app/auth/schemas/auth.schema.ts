import z from 'zod';
import {
	validateEmail,
	validatePassword,
	validatePhoneNumber,
	validateString,
} from '../../../core/validators/common.schema';

export const loginSchema = z
	.object({
		email: validateEmail,
		password: validateString('Password'),
	})
	.strict();

export const googleLoginSchema = z
	.object({
		credential: validateString('Google credential'),
	})
	.strict();

const magicLinkRedirectSchema = z.preprocess(
	value => {
		if (Array.isArray(value)) return value[0] as unknown;
		if (typeof value !== 'string') return undefined;

		const trimmed = value.trim();
		return trimmed || undefined;
	},
	validateString('Redirect URL', { max: 2048 }).optional(),
);

export const magicLinkRequestSchema = z
	.object({
		email: validateEmail,
		redirectUrl: magicLinkRedirectSchema,
	})
	.strict();

export const magicLinkVerifySchema = z
	.object({
		email: validateEmail,
		token: validateString('Magic link token'),
		redirect: magicLinkRedirectSchema,
		redirectUrl: magicLinkRedirectSchema,
	})
	.strict();

export const registerSchema = z
	.object({
		name: validateString('Name').optional(),
		email: validateEmail,
		password: validatePassword,
		image: validateString('Image').optional(),
		phone: validatePhoneNumber('Phone').optional(),
	})
	.strict();

export const updateProfileSchema = z
	.object({
		name: validateString('Name').optional(),
		image: validateString('Image').optional(),
		phone: validatePhoneNumber('Phone').optional(),
	})
	.strict();

export type LoginDto = z.infer<typeof loginSchema>;
export type GoogleLoginDto = z.infer<typeof googleLoginSchema>;
export type MagicLinkRequestDto = z.infer<typeof magicLinkRequestSchema>;
export type MagicLinkVerifyDto = z.infer<typeof magicLinkVerifySchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
