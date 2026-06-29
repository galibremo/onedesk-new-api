export interface FacebookChannelCredentials {
	facebookPageId: string;
	pageAccessToken: string;
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
