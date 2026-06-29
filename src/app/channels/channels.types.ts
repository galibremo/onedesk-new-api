import type { ChannelStatusEnum, ChannelTypeEnum } from '../../core/database/types';

export interface ChannelResponse {
	id: string;
	name: string;
	channelType: ChannelTypeEnum;
	status: ChannelStatusEnum;
	createdAt: Date;
}

export interface ChannelsListResponse {
	rows: ChannelResponse[];
	total: number;
	page: number;
	pageSize: number;
}

export interface DisconnectChannelResponse {
	disconnected: boolean;
}

export interface OAuthUrlResponse {
	url: string;
}

export interface RefreshTokenResponse {
	refreshed: boolean;
}
