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
	facebookConnectPagesSchema,
	type OAuthCallbackDto,
	type FacebookConnectPagesDto,
} from '../channels.schema';
import type { OAuthUrlResponse, RefreshTokenResponse, ChannelsListResponse } from '../channels.types';
import type { FacebookCallbackResponse } from './facebook.types';
import { FacebookService } from './facebook.service';

@UseGuards(JwtAuthGuard)
@Controller('channels/facebook')
export class FacebookController {
	constructor(private readonly facebookService: FacebookService) {}

	@Get('oauth/url')
	async getOAuthUrl(
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<OAuthUrlResponse>> {
		const result = await this.facebookService.generateOAuthUrl(currentUser.id);
		return createApiResponse(HttpStatus.OK, 'OAuth URL generated successfully', result);
	}

	@Post('oauth/callback')
	async handleCallback(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(oauthCallbackSchema)) body: OAuthCallbackDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<FacebookCallbackResponse>> {
		const result = await this.facebookService.handleOAuthCallback(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Facebook pages retrieved successfully', result);
	}

	@Post('pages')
	async connectPages(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(facebookConnectPagesSchema)) body: FacebookConnectPagesDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<ChannelsListResponse>> {
		const result = await this.facebookService.connectPages(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Facebook pages connected successfully', result);
	}

	@Post('token/refresh')
	async refreshToken(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<RefreshTokenResponse>> {
		const result = await this.facebookService.refreshToken(currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Facebook token refreshed successfully', result);
	}
}
