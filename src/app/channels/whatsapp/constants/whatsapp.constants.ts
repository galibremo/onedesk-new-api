export const SOCIAL_PROVIDER_WHATSAPP = 'SOCIAL_PROVIDER_WHATSAPP';

export const WHATSAPP_GRAPH_VERSION = 'v20.0';
export const WHATSAPP_GRAPH_BASE_URL = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`;
export const WHATSAPP_OAUTH_DIALOG_URL = `https://www.facebook.com/${WHATSAPP_GRAPH_VERSION}/dialog/oauth`;

export const WHATSAPP_PERMISSIONS = [
	'whatsapp_business_management',
	'whatsapp_business_messaging',
	'business_management',
] as const;

export const WHATSAPP_AUDIT_ACTIONS = {
	OAUTH_CALLBACK: 'WHATSAPP_OAUTH_CALLBACK',
	PHONES_CONNECTED: 'WHATSAPP_PHONES_CONNECTED',
	TOKEN_REFRESHED: 'WHATSAPP_TOKEN_REFRESHED',
} as const;
