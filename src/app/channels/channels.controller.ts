import {
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Query,
	Request,
	UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
	type ApiResponse,
	createApiResponse,
} from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserWithoutPassword } from '../auth/auth.types';

import { channelsListQuerySchema, type ChannelsListQueryDto } from './channels.schema';
import { ChannelsService } from './channels.service';
import type { ChannelsListResponse, DisconnectChannelResponse } from './channels.types';

@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
	constructor(private readonly channelsService: ChannelsService) {}

	@Get()
	async listChannels(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Query(new ZodValidationPipe(channelsListQuerySchema)) query: ChannelsListQueryDto,
	): Promise<ApiResponse<ChannelsListResponse>> {
		const result = await this.channelsService.listChannels(currentUser.id, query);
		return createApiResponse(HttpStatus.OK, 'Channels fetched successfully', result);
	}

	@Delete(':channelId')
	async disconnectChannel(
		@Param('channelId', ParseUUIDPipe) channelId: string,
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<DisconnectChannelResponse>> {
		const result = await this.channelsService.disconnectChannel(channelId, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Channel disconnected successfully', result);
	}
}
