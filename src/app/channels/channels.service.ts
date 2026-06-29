import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';

import { notFoundError } from '../../core/errors/domain-error';
import type { UserWithoutPassword } from '../auth/auth.types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ChannelsRepository } from './channels.repository';
import type { ChannelsListQueryDto } from './channels.schema';
import { mapChannelResponse } from './channels.mapper';
import type { ChannelsListResponse, DisconnectChannelResponse } from './channels.types';

@Injectable()
export class ChannelsService {
	private readonly logger = new Logger(ChannelsService.name);

	constructor(
		private readonly channelsRepository: ChannelsRepository,
		private readonly auditLogService: AuditLogService,
	) {}

	async listChannels(userId: number, query: ChannelsListQueryDto): Promise<ChannelsListResponse> {
		const { rows, total, page, pageSize } = await this.channelsRepository.listChannels(
			userId,
			query,
		);
		return { rows: rows.map(mapChannelResponse), total, page, pageSize };
	}

	async disconnectChannel(
		channelPublicId: string,
		currentUser: UserWithoutPassword,
		request: Request,
	): Promise<DisconnectChannelResponse> {
		const channel = await this.channelsRepository.findByPublicId(channelPublicId, currentUser.id);
		if (!channel) {
			throw notFoundError('channel_not_found', 'Channel not found');
		}

		await this.channelsRepository.softDelete(channel.id);

		await this.auditLogService.logAction({
			actor: currentUser,
			action: 'CHANNEL_DISCONNECTED',
			targetType: 'channel',
			targetId: channel.publicId,
			metadata: { channelType: channel.channelType, name: channel.name },
			request,
		});

		return { disconnected: true };
	}
}
