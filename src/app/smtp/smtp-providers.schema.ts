import { z } from 'zod';

import { baseQuerySchema, type SortableField } from '../../core/validators/base-query.schema';
import { validateString } from '../../core/validators/common.schema';

const SMTP_PROVIDER_TYPES = ['brevo', 'resend', 'nodemailer', 'aws-ses'] as const;

const SMTP_SORTABLE_FIELDS: readonly SortableField[] = [
	{ name: 'name', queryName: 'name' },
	{ name: 'providerType', queryName: 'providerType' },
	{ name: 'isDefault', queryName: 'isDefault' },
	{ name: 'isActive', queryName: 'isActive' },
	{ name: 'lastTestStatus', queryName: 'lastTestStatus' },
	{ name: 'createdAt', queryName: 'createdAt' },
	{ name: 'updatedAt', queryName: 'updatedAt' },
] as const;

const providerTypeSchema = validateString('Provider Type').refine(
	value => SMTP_PROVIDER_TYPES.includes(value as (typeof SMTP_PROVIDER_TYPES)[number]),
	{ message: 'Provider type must be one of: brevo, resend, nodemailer, aws-ses' },
);

const brevoConfigSchema = z.object({
	apiKey: validateString('API Key'),
	senderEmail: validateString('Sender Email').email('Sender Email must be a valid email'),
	senderName: validateString('Sender Name'),
});

const resendConfigSchema = z.object({
	apiKey: validateString('API Key'),
	senderEmail: validateString('Sender Email').email('Sender Email must be a valid email'),
	senderName: validateString('Sender Name'),
});

const nodemailerConfigSchema = z.object({
	host: validateString('Host'),
	port: z.coerce.number().int().positive('Port must be a positive integer'),
	secure: z.preprocess(value => {
		if (typeof value === 'boolean') return value;
		if (typeof value === 'string') return value.toLowerCase() === 'true';
		return false;
	}, z.boolean()),
	auth: z.object({
		user: validateString('Username'),
		pass: validateString('Password'),
	}),
	senderEmail: validateString('Sender Email').email('Sender Email must be a valid email'),
	senderName: validateString('Sender Name'),
});

const awsSesConfigSchema = z.object({
	accessKeyId: validateString('Access Key ID'),
	secretAccessKey: validateString('Secret Access Key'),
	region: validateString('Region'),
	senderEmail: validateString('Sender Email').email('Sender Email must be a valid email'),
	senderName: validateString('Sender Name'),
});

const configByTypeSchema: Record<string, z.ZodType> = {
	brevo: brevoConfigSchema,
	resend: resendConfigSchema,
	nodemailer: nodemailerConfigSchema,
	'aws-ses': awsSesConfigSchema,
};

export const createSmtpProviderSchema = z
	.object({
		name: validateString('Name', { max: 100 }),
		providerType: providerTypeSchema,
		config: z.unknown(),
	})
	.strict()
	.superRefine((data, ctx) => {
		const configSchema = configByTypeSchema[data.providerType];
		if (!configSchema) {
			ctx.addIssue({
				code: 'custom',
				message: `Unknown provider type: ${data.providerType}`,
				path: ['providerType'],
			});
			return;
		}

		const result = configSchema.safeParse(data.config);
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({
					...issue,
					path: ['config', ...(issue.path || [])],
				});
			}
		}
	});

export const updateSmtpProviderSchema = z
	.object({
		name: validateString('Name', { max: 100 }).optional(),
		config: z.unknown().optional(),
	})
	.strict()
	.refine(data => Object.keys(data).length > 0, {
		message: 'At least one field must be provided',
	});

export const smtpProvidersListQuerySchema = baseQuerySchema(SMTP_SORTABLE_FIELDS).safeExtend({
	providerType: providerTypeSchema.optional(),
	isActive: z.preprocess(value => {
		if (typeof value !== 'string') return undefined;
		const normalized = value.trim().toLowerCase();
		return normalized === 'true' ? true : normalized === 'false' ? false : undefined;
	}, z.boolean().optional()),
});

export type CreateSmtpProviderDto = z.infer<typeof createSmtpProviderSchema>;
export type UpdateSmtpProviderDto = z.infer<typeof updateSmtpProviderSchema>;
export type SmtpProvidersListQueryDto = z.infer<typeof smtpProvidersListQuerySchema>;
