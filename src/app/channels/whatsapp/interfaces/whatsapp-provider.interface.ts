export interface OAuthUrlResult {
	url: string;
	state: string;
}

export interface WhatsAppPhoneInfo {
	phoneNumberId: string;
	displayPhoneNumber: string;
	verifiedName: string;
	wabaId: string;
	phoneNumberStatus: string;
}

export interface TokenResult {
	accessToken: string;
	expiresAt: Date | null;
	whatsappUserId: string;
}

export interface RefreshResult {
	accessToken: string;
	expiresAt: Date | null;
}

export interface WhatsAppProviderInterface {
	authenticate(userId: number): Promise<OAuthUrlResult>;
	exchangeCode(code: string, redirectUri: string): Promise<TokenResult>;
	getPhoneNumbers(accessToken: string): Promise<WhatsAppPhoneInfo[]>;
	refreshToken(accessToken: string): Promise<RefreshResult>;
	disconnect(whatsappUserId: string, accessToken: string): Promise<void>;
	subscribeWebhook(wabaId: string, accessToken: string): Promise<void>;
}
