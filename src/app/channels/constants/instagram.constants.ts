export const SOCIAL_PROVIDER_INSTAGRAM = 'SOCIAL_PROVIDER_INSTAGRAM';

export const INSTAGRAM_GRAPH_VERSION = 'v20.0';
export const INSTAGRAM_GRAPH_BASE_URL = `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}`;
export const INSTAGRAM_OAUTH_DIALOG_URL = `https://www.facebook.com/${INSTAGRAM_GRAPH_VERSION}/dialog/oauth`;

export const INSTAGRAM_PERMISSIONS = [
	'instagram_basic',
	'instagram_manage_messages',
	'pages_show_list',
	'pages_read_engagement',
	'pages_manage_metadata',
	'business_management',
] as const;

export const INSTAGRAM_AUDIT_ACTIONS = {
	OAUTH_CALLBACK: 'INSTAGRAM_OAUTH_CALLBACK',
	ACCOUNTS_CONNECTED: 'INSTAGRAM_ACCOUNTS_CONNECTED',
	TOKEN_REFRESHED: 'INSTAGRAM_TOKEN_REFRESHED',
} as const;
