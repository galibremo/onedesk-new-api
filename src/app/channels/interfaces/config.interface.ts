export interface FacebookChannelConfig {
	facebookPageId: string;
	facebookUserId: string;
	facebookAccountPublicId: string;
	pageAccessToken: string;
	pageCategory?: string;
	profilePicture?: string;
}

export interface InstagramChannelConfig {
	instagramAccountId: string;
	instagramUsername: string;
	instagramName: string;
	profilePictureUrl?: string;
	followersCount?: number;
	facebookPageId: string;
	facebookPageName: string;
	instagramUserId: string;
	instagramAccountPublicId: string;
	pageAccessToken: string;
}

export interface WhatsAppChannelConfig {
	phoneNumberId: string;
	displayPhoneNumber: string;
	verifiedName: string;
	wabaId: string;
	whatsappUserId: string;
	whatsappAccountPublicId: string;
	accessToken: string;
	phoneNumberStatus: string;
}
