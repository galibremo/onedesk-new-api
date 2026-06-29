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
