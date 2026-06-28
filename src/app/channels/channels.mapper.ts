import type { ChannelSchemaType } from '../../core/database/types';
import type { PageInfo } from './interfaces/social-provider.interface';
import type { ChannelResponse, FacebookPageInfoResponse } from './channels.types';

export function mapChannelResponse(row: ChannelSchemaType): ChannelResponse {
	return {
		id: row.publicId,
		name: row.name,
		channelType: row.channelType,
		status: row.status,
		createdAt: row.createdAt,
	};
}

export function mapPageInfoToResponse(page: PageInfo): FacebookPageInfoResponse {
	return {
		facebookPageId: page.pageId,
		pageName: page.pageName,
		pageCategory: page.pageCategory,
		profilePicture: page.profilePicture,
	};
}
