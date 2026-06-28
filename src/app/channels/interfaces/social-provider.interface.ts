export interface OAuthUrlResult {
	url: string;
	state: string;
}

export interface PageInfo {
	pageId: string;
	pageName: string;
	pageAccessToken: string;
	pageCategory?: string;
	profilePicture?: string;
}

export interface TokenResult {
	accessToken: string;
	expiresAt: Date | null;
	facebookUserId: string;
}

export interface RefreshResult {
	accessToken: string;
	expiresAt: Date | null;
}

export interface SocialProviderInterface {
	/**
	 * Generate an OAuth authorization URL and a signed, tamper-proof state JWT.
	 */
	authenticate(userId: number): Promise<OAuthUrlResult>;

	/**
	 * Exchange an OAuth authorization code for a long-lived user access token.
	 */
	exchangeCode(code: string, redirectUri: string): Promise<TokenResult>;

	/**
	 * Fetch all Facebook Pages managed by the user represented by accessToken.
	 */
	getPages(accessToken: string): Promise<PageInfo[]>;

	/**
	 * Extend a short-lived token to a long-lived one (60-day).
	 */
	refreshToken(accessToken: string): Promise<RefreshResult>;

	/**
	 * Revoke the app's access for a given Facebook user.
	 */
	disconnect(facebookUserId: string, accessToken: string): Promise<void>;

	/**
	 * Subscribe a page to the app's webhook for the given fields.
	 */
	subscribeWebhook(pageId: string, pageAccessToken: string, fields: string[]): Promise<void>;
}
