import { InternalServerErrorException } from '@nestjs/common';
import type { InstagramAccountInfo, RefreshResult } from '../interfaces/instagram-provider.interface';
import { INSTAGRAM_GRAPH_BASE_URL } from '../constants/instagram.constants';

async function graphFetch<T>(url: string, options?: RequestInit): Promise<T> {
	const res = await fetch(url, options);
	const body = (await res.json()) as T & { error?: { message: string; code: number } };
	if (!res.ok || (body as { error?: { message: string } }).error) {
		const err = (body as { error?: { message: string } }).error;
		throw new InternalServerErrorException(
			`Instagram Graph API error: ${err?.message ?? res.statusText}`,
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
		`${INSTAGRAM_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`,
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
		`${INSTAGRAM_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`,
	);
	const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
	return { accessToken: data.access_token, expiresAt };
}

export async function getMetaUserId(accessToken: string): Promise<string> {
	const params = new URLSearchParams({ fields: 'id', access_token: accessToken });
	const data = await graphFetch<{ id: string }>(
		`${INSTAGRAM_GRAPH_BASE_URL}/me?${params.toString()}`,
	);
	return data.id;
}

export async function getInstagramBusinessAccounts(
	accessToken: string,
): Promise<InstagramAccountInfo[]> {
	const accounts: InstagramAccountInfo[] = [];

	// Step 1: get Facebook Pages the user manages
	const pageParams = new URLSearchParams({
		fields: 'id,name,access_token',
		access_token: accessToken,
	});
	const pageData = await graphFetch<{
		data: Array<{ id: string; name: string; access_token: string }>;
	}>(`${INSTAGRAM_GRAPH_BASE_URL}/me/accounts?${pageParams.toString()}`);

	// Step 2: for each page, check if it has a linked Instagram Business Account
	for (const page of pageData.data) {
		try {
			const igParams = new URLSearchParams({
				fields: 'instagram_business_account',
				access_token: page.access_token,
			});
			const igLinkData = await graphFetch<{
				instagram_business_account?: { id: string };
			}>(`${INSTAGRAM_GRAPH_BASE_URL}/${page.id}?${igParams.toString()}`);

			if (!igLinkData.instagram_business_account) {
				continue;
			}

			const igAccountId = igLinkData.instagram_business_account.id;

			// Step 3: get Instagram account details
			const detailParams = new URLSearchParams({
				fields: 'id,name,username,profile_picture_url,followers_count',
				access_token: page.access_token,
			});
			const igDetail = await graphFetch<{
				id: string;
				name: string;
				username: string;
				profile_picture_url?: string;
				followers_count?: number;
			}>(`${INSTAGRAM_GRAPH_BASE_URL}/${igAccountId}?${detailParams.toString()}`);

			accounts.push({
				instagramAccountId: igDetail.id,
				instagramUsername: igDetail.username,
				instagramName: igDetail.name,
				profilePictureUrl: igDetail.profile_picture_url,
				followersCount: igDetail.followers_count,
				facebookPageId: page.id,
				facebookPageName: page.name,
				pageAccessToken: page.access_token,
			});
		} catch {
			continue;
		}
	}

	return accounts;
}

export async function subscribePageToInstagramWebhook(
	pageId: string,
	pageAccessToken: string,
): Promise<void> {
	const params = new URLSearchParams({
		subscribed_fields: 'messages,messaging_postbacks,messaging_optins',
		access_token: pageAccessToken,
	});
	await graphFetch<{ success: boolean }>(
		`${INSTAGRAM_GRAPH_BASE_URL}/${pageId}/subscribed_apps?${params.toString()}`,
		{ method: 'POST' },
	);
}

export async function revokeInstagramAccess(
	instagramUserId: string,
	accessToken: string,
): Promise<void> {
	const params = new URLSearchParams({ access_token: accessToken });
	await graphFetch<{ success: boolean }>(
		`${INSTAGRAM_GRAPH_BASE_URL}/${instagramUserId}/permissions?${params.toString()}`,
		{ method: 'DELETE' },
	);
}
