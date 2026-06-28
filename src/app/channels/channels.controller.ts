import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
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

import {
	channelsListQuerySchema,
	oauthCallbackSchema,
	facebookConnectPagesSchema,
	instagramConnectAccountsSchema,
	whatsappConnectPhonesSchema,
	type ChannelsListQueryDto,
	type OAuthCallbackDto,
	type FacebookConnectPagesDto,
	type InstagramConnectAccountsDto,
	type WhatsappConnectPhonesDto,
} from './channels.schema';
import { ChannelsService } from './channels.service';
import type {
	ChannelsListResponse,
	DisconnectChannelResponse,
	OAuthUrlResponse,
	RefreshTokenResponse,
	FacebookCallbackResponse,
	InstagramCallbackResponse,
	WhatsAppCallbackResponse,
} from './channels.types';

@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
	constructor(private readonly channelsService: ChannelsService) {}

	// ── Core Channel Routes ──────────────────────────────────────────────

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

	// ── Facebook Routes ──────────────────────────────────────────────────

	@Get('facebook/oauth/url')
	async getFacebookOAuthUrl(
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<OAuthUrlResponse>> {
		const result = await this.channelsService.generateFacebookOAuthUrl(currentUser.id);
		return createApiResponse(HttpStatus.OK, 'OAuth URL generated successfully', result);
	}

	@Post('facebook/oauth/callback')
	async handleFacebookCallback(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(oauthCallbackSchema)) body: OAuthCallbackDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<FacebookCallbackResponse>> {
		const result = await this.channelsService.handleFacebookOAuthCallback(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Facebook pages retrieved successfully', result);
	}

	@Post('facebook/pages')
	async connectFacebookPages(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(facebookConnectPagesSchema)) body: FacebookConnectPagesDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<ChannelsListResponse>> {
		const result = await this.channelsService.connectFacebookPages(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Facebook pages connected successfully', result);
	}

	@Post('facebook/token/refresh')
	async refreshFacebookToken(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<RefreshTokenResponse>> {
		const result = await this.channelsService.refreshFacebookToken(currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Facebook token refreshed successfully', result);
	}

	// ── Instagram Routes ─────────────────────────────────────────────────

	@Get('instagram/oauth/url')
	async getInstagramOAuthUrl(
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<OAuthUrlResponse>> {
		const result = await this.channelsService.generateInstagramOAuthUrl(currentUser.id);
		return createApiResponse(HttpStatus.OK, 'OAuth URL generated successfully', result);
	}

	@Post('instagram/oauth/callback')
	async handleInstagramCallback(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(oauthCallbackSchema)) body: OAuthCallbackDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<InstagramCallbackResponse>> {
		const result = await this.channelsService.handleInstagramOAuthCallback(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Instagram accounts retrieved successfully', result);
	}

	@Post('instagram/accounts')
	async connectInstagramAccounts(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(instagramConnectAccountsSchema)) body: InstagramConnectAccountsDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<ChannelsListResponse>> {
		const result = await this.channelsService.connectInstagramAccounts(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Instagram accounts connected successfully', result);
	}

	@Post('instagram/token/refresh')
	async refreshInstagramToken(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<RefreshTokenResponse>> {
		const result = await this.channelsService.refreshInstagramToken(currentUser, request);
		return createApiResponse(HttpStatus.OK, 'Instagram token refreshed successfully', result);
	}

	// ── WhatsApp Routes ──────────────────────────────────────────────────

	@Get('whatsapp/oauth/url')
	async getWhatsAppOAuthUrl(
		@CurrentUser() currentUser: UserWithoutPassword,
	): Promise<ApiResponse<OAuthUrlResponse>> {
		const result = await this.channelsService.generateWhatsAppOAuthUrl(currentUser.id);
		return createApiResponse(HttpStatus.OK, 'OAuth URL generated successfully', result);
	}

	@Post('whatsapp/oauth/callback')
	async handleWhatsAppCallback(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(oauthCallbackSchema)) body: OAuthCallbackDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<WhatsAppCallbackResponse>> {
		const result = await this.channelsService.handleWhatsAppOAuthCallback(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'WhatsApp phone numbers retrieved successfully', result);
	}

	@Post('whatsapp/phones')
	async connectWhatsAppPhones(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Body(new ZodValidationPipe(whatsappConnectPhonesSchema)) body: WhatsappConnectPhonesDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<ChannelsListResponse>> {
		const result = await this.channelsService.connectWhatsAppPhones(body, currentUser, request);
		return createApiResponse(HttpStatus.OK, 'WhatsApp phones connected successfully', result);
	}

	@Post('whatsapp/token/refresh')
	async refreshWhatsAppToken(
		@CurrentUser() currentUser: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<RefreshTokenResponse>> {
		const result = await this.channelsService.refreshWhatsAppToken(currentUser, request);
		return createApiResponse(HttpStatus.OK, 'WhatsApp token refreshed successfully', result);
	}
}
