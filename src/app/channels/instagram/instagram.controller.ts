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
	instagramConnectAccountsSchema,
	type OAuthCallbackDto,
	type InstagramConnectAccountsDto,
} from '../channels.schema';
import type { OAuthUrlResponse, RefreshTokenResponse, ChannelsListResponse } from '../channels.types';
import type { InstagramCallbackResponse } from './instagram.types';
import { InstagramService } from './instagram.service';

@UseGuards(JwtAuthGuard)
@Controller('channels/instagram')
export class InstagramController {
	constructor(private readonly instagramService: InstagramService) {}

	@Get('oauth/url')
	async getOAuthUrl(
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<OAuthUrlResponse>> {
		const result = await this.instagramService.generateOAuthUrl(currentUser.id);
		return createApiResponse(HttpStatus.OK, 'OAuth URL generated successfully', result);
	}

	@Post('oauth/callback')
	async handleCallback(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(oauthCallbackSchema)) body: OAuthCallbackDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<InstagramCallbackResponse>> {
		const result = await this.instagramService.handleOAuthCallback(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Instagram accounts retrieved successfully', result);
	}

	@Post('accounts')
	async connectAccounts(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(instagramConnectAccountsSchema)) body: InstagramConnectAccountsDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<ChannelsListResponse>> {
		const result = await this.instagramService.connectAccounts(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Instagram accounts connected successfully', result);
	}

	@Post('token/refresh')
	async refreshToken(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<RefreshTokenResponse>> {
		const result = await this.instagramService.refreshToken(currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Instagram token refreshed successfully', result);
	}
}
