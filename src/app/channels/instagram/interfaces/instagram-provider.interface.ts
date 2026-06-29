export interface OAuthUrlResult {
	url: string;
	state: string;
}

export interface InstagramAccountInfo {
	instagramAccountId: string;
	instagramUsername: string;
	instagramName: string;
	profilePictureUrl?: string;
	followersCount?: number;
	facebookPageId: string;
	facebookPageName: string;
	pageAccessToken: string;
}

export interface TokenResult {
	accessToken: string;
	expiresAt: Date | null;
	instagramUserId: string;
}

export interface RefreshResult {
	accessToken: string;
	expiresAt: Date | null;
}

export interface InstagramProviderInterface {
	authenticate(userId: number): Promise<OAuthUrlResult>;
	exchangeCode(code: string, redirectUri: string): Promise<TokenResult>;
	getInstagramAccounts(accessToken: string): Promise<InstagramAccountInfo[]>;
	refreshToken(accessToken: string): Promise<RefreshResult>;
	disconnect(instagramUserId: string, accessToken: string): Promise<void>;
	subscribeWebhook(pageId: string, pageAccessToken: string): Promise<void>;
}
