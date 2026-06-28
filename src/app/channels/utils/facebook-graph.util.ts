import { InternalServerErrorException } from '@nestjs/common';
import type { PageInfo, RefreshResult, TokenResult } from '../interfaces/social-provider.interface';
import { FACEBOOK_GRAPH_BASE_URL } from '../constants/facebook.constants';

async function graphFetch<T>(url: string, options?: RequestInit): Promise<T> {
	const res = await fetch(url, options);
	const body = (await res.json()) as T & { error?: { message: string; code: number } };
	if (!res.ok || (body as { error?: { message: string } }).error) {
		const err = (body as { error?: { message: string } }).error;
		throw new InternalServerErrorException(
			`Facebook Graph API error: ${err?.message ?? res.statusText}`,
		);
	}
	return body;
}

export async function exchangeCodeForToken(
	appId: string,
	appSecret: string,
	code: string,
	redirectUri: string,
): Promise<{ access_token: string; token_type: string }> {
	const params = new URLSearchParams({
		client_id: appId,
		client_secret: appSecret,
		redirect_uri: redirectUri,
		code,
	});
	return graphFetch<{ access_token: string; token_type: string }>(
		`${FACEBOOK_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`,
	);
}

export async function exchangeForLongLivedToken(
	appId: string,
	appSecret: string,
	shortLivedToken: string,
): Promise<RefreshResult> {
	const params = new URLSearchParams({
		grant_type: 'fb_exchange_token',
		client_id: appId,
		client_secret: appSecret,
		fb_exchange_token: shortLivedToken,
	});
	const data = await graphFetch<{ access_token: string; expires_in?: number }>(
		`${FACEBOOK_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`,
	);
	const expiresAt = data.expires_in
		? new Date(Date.now() + data.expires_in * 1000)
		: null;
	return { accessToken: data.access_token, expiresAt };
}

export async function getFacebookUserId(accessToken: string): Promise<string> {
	const params = new URLSearchParams({ fields: 'id', access_token: accessToken });
	const data = await graphFetch<{ id: string }>(
		`${FACEBOOK_GRAPH_BASE_URL}/me?${params.toString()}`,
	);
	return data.id;
}

export async function getTokenDetails(accessToken: string): Promise<TokenResult> {
	const { accessToken: longLivedToken, expiresAt } = await exchangeForLongLivedToken(
		'',
		'',
		accessToken,
	);
	const facebookUserId = await getFacebookUserId(longLivedToken);
	return { accessToken: longLivedToken, expiresAt, facebookUserId };
}

export async function getGrantedPermissions(accessToken: string): Promise<string[]> {
	const params = new URLSearchParams({ access_token: accessToken });
	const data = await graphFetch<{ data: Array<{ permission: string; status: string }> }>(
		`${FACEBOOK_GRAPH_BASE_URL}/me/permissions?${params.toString()}`,
	);
	return data.data.filter(p => p.status === 'granted').map(p => p.permission);
}

type RawPage = {
	id: string;
	name: string;
	access_token: string;
	category?: string;
	picture?: { data?: { url?: string } };
};

function mapRawPage(page: RawPage): PageInfo {
	return {
		pageId: page.id,
		pageName: page.name,
		pageAccessToken: page.access_token,
		pageCategory: page.category,
		profilePicture: page.picture?.data?.url,
	};
}

async function fetchPageList(endpoint: string, accessToken: string): Promise<PageInfo[]> {
	const params = new URLSearchParams({
		fields: 'id,name,access_token,category,picture{url}',
		access_token: accessToken,
	});
	const data = await graphFetch<{ data: RawPage[] }>(`${endpoint}?${params.toString()}`);
	return data.data.map(mapRawPage);
}

export async function getManagedPages(accessToken: string): Promise<PageInfo[]> {
	// Personal pages (direct page admin role)
	const personalPages = await fetchPageList(
		`${FACEBOOK_GRAPH_BASE_URL}/me/accounts`,
		accessToken,
	);
	if (personalPages.length > 0) return personalPages;

	// Fallback: pages managed through Business Manager
	try {
		const bizParams = new URLSearchParams({ fields: 'id', access_token: accessToken });
		const bizData = await graphFetch<{ data: Array<{ id: string }> }>(
			`${FACEBOOK_GRAPH_BASE_URL}/me/businesses?${bizParams.toString()}`,
		);

		const businessPages: PageInfo[] = [];
		for (const biz of bizData.data) {
			const pages = await fetchPageList(
				`${FACEBOOK_GRAPH_BASE_URL}/${biz.id}/owned_pages`,
				accessToken,
			);
			businessPages.push(...pages);
		}
		return businessPages;
	} catch {
		return [];
	}
}

export async function revokeAppAccess(
	facebookUserId: string,
	accessToken: string,
): Promise<void> {
	const params = new URLSearchParams({ access_token: accessToken });
	await graphFetch<{ success: boolean }>(
		`${FACEBOOK_GRAPH_BASE_URL}/${facebookUserId}/permissions?${params.toString()}`,
		{ method: 'DELETE' },
	);
}

export async function subscribePageToWebhook(
	pageId: string,
	pageAccessToken: string,
	fields: string[],
): Promise<void> {
	const params = new URLSearchParams({
		subscribed_fields: fields.join(','),
		access_token: pageAccessToken,
	});
	await graphFetch<{ success: boolean }>(
		`${FACEBOOK_GRAPH_BASE_URL}/${pageId}/subscribed_apps?${params.toString()}`,
		{ method: 'POST' },
	);
}
