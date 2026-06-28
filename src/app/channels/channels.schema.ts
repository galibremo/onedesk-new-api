import { z } from 'zod';
import { baseQuerySchema } from '../../core/validators/base-query.schema';
import { validateString } from '../../core/validators/common.schema';

const CHANNEL_SORTABLE_FIELDS = [
	{ name: 'name', queryName: 'name' },
	{ name: 'channelType', queryName: 'channelType' },
	{ name: 'createdAt', queryName: 'createdAt' },
] as const;

export const channelsListQuerySchema = baseQuerySchema(CHANNEL_SORTABLE_FIELDS);

export const oauthCallbackSchema = z
	.object({
		code: validateString('code'),
		state: validateString('state'),
	})
	.strict();

export const facebookConnectPagesSchema = z
	.object({
		facebookAccountPublicId: validateString('facebookAccountPublicId'),
		pageIds: z.array(validateString('pageId')).min(1, 'At least one page must be selected'),
	})
	.strict();

export const instagramConnectAccountsSchema = z
	.object({
		instagramAccountPublicId: validateString('instagramAccountPublicId'),
		instagramAccountIds: z
			.array(validateString('instagramAccountId'))
			.min(1, 'At least one Instagram account must be selected'),
	})
	.strict();

export const whatsappConnectPhonesSchema = z
	.object({
		whatsappAccountPublicId: validateString('whatsappAccountPublicId'),
		phoneNumberIds: z
			.array(validateString('phoneNumberId'))
			.min(1, 'At least one phone number must be selected'),
	})
	.strict();

export type ChannelsListQueryDto = z.infer<typeof channelsListQuerySchema>;
export type OAuthCallbackDto = z.infer<typeof oauthCallbackSchema>;
export type FacebookConnectPagesDto = z.infer<typeof facebookConnectPagesSchema>;
export type InstagramConnectAccountsDto = z.infer<typeof instagramConnectAccountsSchema>;
export type WhatsappConnectPhonesDto = z.infer<typeof whatsappConnectPhonesSchema>;
