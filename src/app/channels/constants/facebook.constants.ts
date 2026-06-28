export const SOCIAL_PROVIDER_FACEBOOK = 'SOCIAL_PROVIDER_FACEBOOK';

export const FACEBOOK_GRAPH_VERSION = 'v20.0';
export const FACEBOOK_GRAPH_BASE_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`;
export const FACEBOOK_OAUTH_DIALOG_URL = `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`;

// Requires "Manage Pages", "Messenger API for Pages", and "Manage Business" use cases
// in Meta Developer Dashboard.
// business_management: required to query /me/businesses for Business Manager pages
//   (pages under Business Manager never appear in /me/accounts without this)
export const FACEBOOK_PERMISSIONS = [
	'pages_show_list',
	'pages_read_engagement',
	'pages_manage_metadata',
	'pages_messaging',
	'business_management',
] as const;

export const FACEBOOK_AUDIT_ACTIONS = {
	OAUTH_CALLBACK: 'FACEBOOK_OAUTH_CALLBACK',
	PAGES_CONNECTED: 'FACEBOOK_PAGES_CONNECTED',
	PAGE_DISCONNECTED: 'FACEBOOK_PAGE_DISCONNECTED',
	TOKEN_REFRESHED: 'FACEBOOK_TOKEN_REFRESHED',
} as const;
