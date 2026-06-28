import type { ChannelStatusEnum, ChannelTypeEnum } from '../../core/database/types';

export interface ChannelResponse {
	id: string;
	name: string;
	channelType: ChannelTypeEnum;
	status: ChannelStatusEnum;
	createdAt: Date;
}

export interface ChannelsListResponse {
	rows: ChannelResponse[];
	total: number;
	page: number;
	pageSize: number;
}

export interface DisconnectChannelResponse {
	disconnected: boolean;
}

export interface FacebookChannelCredentials {
	facebookPageId: string;
	pageAccessToken: string;
}

export interface OAuthUrlResponse {
	url: string;
}

export interface RefreshTokenResponse {
	refreshed: boolean;
}

export interface FacebookPageInfoResponse {
	facebookPageId: string;
	pageName: string;
	pageCategory?: string;
	profilePicture?: string;
}

export interface FacebookCallbackResponse {
	accountId: string;
	pages: FacebookPageInfoResponse[];
}

export interface InstagramAccountInfoResponse {
	instagramAccountId: string;
	instagramUsername: string;
	instagramName: string;
	profilePictureUrl?: string;
	followersCount?: number;
	facebookPageId: string;
	facebookPageName: string;
}

export interface InstagramCallbackResponse {
	accountId: string;
	accounts: InstagramAccountInfoResponse[];
}

export interface WhatsAppPhoneInfoResponse {
	phoneNumberId: string;
	displayPhoneNumber: string;
	verifiedName: string;
	wabaId: string;
	phoneNumberStatus: string;
}

export interface WhatsAppCallbackResponse {
	accountId: string;
	phoneNumbers: WhatsAppPhoneInfoResponse[];
}
