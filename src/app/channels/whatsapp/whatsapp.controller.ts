import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Post,
	Request,
	UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
	type ApiResponse,
	createApiResponse,
} from '../../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { UserWithoutPassword } from '../../auth/auth.types';
import {
	oauthCallbackSchema,
	whatsappConnectPhonesSchema,
	type OAuthCallbackDto,
	type WhatsappConnectPhonesDto,
} from '../channels.schema';
import type { OAuthUrlResponse, RefreshTokenResponse, ChannelsListResponse } from '../channels.types';
import type { WhatsAppCallbackResponse } from './whatsapp.types';
import { WhatsAppService } from './whatsapp.service';

@UseGuards(JwtAuthGuard)
@Controller('channels/whatsapp')
export class WhatsAppController {
	constructor(private readonly whatsappService: WhatsAppService) {}

	@Get('oauth/url')
	async getOAuthUrl(
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<OAuthUrlResponse>> {
		const result = await this.whatsappService.generateOAuthUrl(currentUser.id);
		return createApiResponse(HttpStatus.OK, 'OAuth URL generated successfully', result);
	}

	@Post('oauth/callback')
	async handleCallback(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(oauthCallbackSchema)) body: OAuthCallbackDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<WhatsAppCallbackResponse>> {
		const result = await this.whatsappService.handleOAuthCallback(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'WhatsApp phone numbers retrieved successfully', result);
	}

	@Post('phones')
	async connectPhones(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(whatsappConnectPhonesSchema)) body: WhatsappConnectPhonesDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<ChannelsListResponse>> {
		const result = await this.whatsappService.connectPhones(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'WhatsApp phones connected successfully', result);
	}

	@Post('token/refresh')
	async refreshToken(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<RefreshTokenResponse>> {
		const result = await this.whatsappService.refreshToken(currentUser, request);
		return createApiResponse(HttpStatus.OK, 'WhatsApp token refreshed successfully', result);
	}
}
