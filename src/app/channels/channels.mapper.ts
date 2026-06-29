import type { ChannelSchemaType } from '../../core/database/types';
import type { ChannelResponse } from './channels.types';

export function mapChannelResponse(row: ChannelSchemaType): ChannelResponse {
	return {
		id: row.publicId,
		name: row.name,
		channelType: row.channelType,
		status: row.status,
		createdAt: row.createdAt,
	};
}
