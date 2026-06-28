import { InternalServerErrorException } from '@nestjs/common';
import type { WhatsAppPhoneInfo, RefreshResult } from '../interfaces/whatsapp-provider.interface';
import { WHATSAPP_GRAPH_BASE_URL } from '../constants/whatsapp.constants';

async function graphFetch<T>(url: string, options?: RequestInit): Promise<T> {
	const res = await fetch(url, options);
	const body = (await res.json()) as T & { error?: { message: string; code: number } };
	if (!res.ok || (body as { error?: { message: string } }).error) {
		const err = (body as { error?: { message: string } }).error;
		throw new InternalServerErrorException(
			`WhatsApp Graph API error: ${err?.message ?? res.statusText}`,
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
		`${WHATSAPP_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`,
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
		`${WHATSAPP_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`,
	);
	const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
	return { accessToken: data.access_token, expiresAt };
}

export async function getMetaUserId(accessToken: string): Promise<string> {
	const params = new URLSearchParams({ fields: 'id', access_token: accessToken });
	const data = await graphFetch<{ id: string }>(
		`${WHATSAPP_GRAPH_BASE_URL}/me?${params.toString()}`,
	);
	return data.id;
}

export async function getWabaPhoneNumbers(accessToken: string): Promise<WhatsAppPhoneInfo[]> {
	const phoneNumbers: WhatsAppPhoneInfo[] = [];

	// Step 1: get all Business Manager accounts for the user
	const bizParams = new URLSearchParams({ fields: 'id', access_token: accessToken });
	const bizData = await graphFetch<{ data: Array<{ id: string }> }>(
		`${WHATSAPP_GRAPH_BASE_URL}/me/businesses?${bizParams.toString()}`,
	);

	// Step 2 + 3: for each business, fetch WABAs, then phone numbers under each WABA
	for (const biz of bizData.data) {
		let wabaIds: string[] = [];

		try {
			const wabaParams = new URLSearchParams({ fields: 'id', access_token: accessToken });
			const wabaData = await graphFetch<{ data: Array<{ id: string }> }>(
				`${WHATSAPP_GRAPH_BASE_URL}/${biz.id}/owned_whatsapp_business_accounts?${wabaParams.toString()}`,
			);
			wabaIds = wabaData.data.map(w => w.id);
		} catch {
			continue;
		}

		for (const wabaId of wabaIds) {
			try {
				const phoneParams = new URLSearchParams({
					fields: 'id,display_phone_number,verified_name,status',
					access_token: accessToken,
				});
				const phoneData = await graphFetch<{
					data: Array<{
						id: string;
						display_phone_number: string;
						verified_name: string;
						status: string;
					}>;
				}>(`${WHATSAPP_GRAPH_BASE_URL}/${wabaId}/phone_numbers?${phoneParams.toString()}`);

				for (const phone of phoneData.data) {
					phoneNumbers.push({
						phoneNumberId: phone.id,
						displayPhoneNumber: phone.display_phone_number,
						verifiedName: phone.verified_name,
						wabaId,
						phoneNumberStatus: phone.status,
					});
				}
			} catch {
				continue;
			}
		}
	}

	return phoneNumbers;
}

export async function subscribeWabaToWebhook(wabaId: string, accessToken: string): Promise<void> {
	const params = new URLSearchParams({ access_token: accessToken });
	await graphFetch<{ success: boolean }>(
		`${WHATSAPP_GRAPH_BASE_URL}/${wabaId}/subscribed_apps?${params.toString()}`,
		{ method: 'POST' },
	);
}

export async function revokeWhatsAppAccess(
	whatsappUserId: string,
	accessToken: string,
): Promise<void> {
	const params = new URLSearchParams({ access_token: accessToken });
	await graphFetch<{ success: boolean }>(
		`${WHATSAPP_GRAPH_BASE_URL}/${whatsappUserId}/permissions?${params.toString()}`,
		{ method: 'DELETE' },
	);
}
