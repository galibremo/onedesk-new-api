import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	Request,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { badRequestError } from '../../core/errors/domain-error';
import { BruteForceGuard } from '../../common/guards/brute-force.guard';
import { AppHelpers } from '../../common/helpers/app.helper';
import {
	type ApiResponse,
	createApiResponse,
} from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EnvType } from '../../core/validators/env';
import { SECURITY_STORE_TOKEN, type ISecurityStore } from '../../core/security-store';
import { FILE_SIZE_LIMIT, singleFileSchema, ZodFileValidationPipe } from '../media/media.pipe';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { UserWithoutPassword, UserWithoutPasswordResponse } from './auth.types';
import { mapUserResponse } from './auth.mapper';
import {
	type GoogleLoginDto,
	googleLoginSchema,
	type MagicLinkRequestDto,
	magicLinkRequestSchema,
	type MagicLinkVerifyDto,
	magicLinkVerifySchema,
	type UpdateProfileDto,
	updateProfileSchema,
} from './schemas/auth.schema';
import {
	type PasswordLoginDto,
	passwordLoginSchema,
	type SetPasswordDto,
	setPasswordSchema,
	type ChangePasswordDto,
	changePasswordSchema,
} from './schemas/password.schema';
import { AuthPolicy } from './auth.policy';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TwoFaRequiredGuard } from './guards/two-fa-required.guard';
import { PartialJwtAuthGuard } from './guards/partial-jwt-auth.guard';
import { mapSessionResponse } from './session/session.mapper';
import { SessionService } from './session/session.service';
import { TwoFactorAlertEmail } from './emails/two-factor-alert.email';
import { type SessionListQueryDto, sessionListQuerySchema } from './session/session.schema';
import type { SessionListResponse, SessionResponse } from './session/session.types';
import { TwoFactorService } from './two-factor/two-factor.service';
import { type TwoFactorCodeDto, twoFactorCodeSchema } from './two-factor/two-factor.schema';
import type {
	TwoFactorDisableResponse,
	TwoFactorRecoveryCodesResponse,
	TwoFactorSetupStartResponse,
	TwoFactorStatusResponse,
	TwoFactorVerifyResponse,
} from './two-factor/two-factor.types';
import type { PartialAuthRequest } from './strategies/jwt-partial.strategy';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly authPolicy: AuthPolicy,
		private readonly sessionService: SessionService,
		private readonly twoFactorService: TwoFactorService,
		private readonly auditLogService: AuditLogService,
		private readonly twoFactorAlertEmail: TwoFactorAlertEmail,
		private readonly configService: ConfigService<EnvType, true>,
		@Inject(SECURITY_STORE_TOKEN)
		private readonly securityStore: ISecurityStore,
	) {}

	@Throttle({
		short: { limit: 1, ttl: 60000 },
		long: { limit: 5, ttl: 300000 },
	})
	@Post('magic-link/request')
	@HttpCode(HttpStatus.OK)
	async requestMagicLink(
		@Body(new ZodValidationPipe(magicLinkRequestSchema)) requestDto: MagicLinkRequestDto,
	): Promise<ApiResponse<null>> {
		await this.authService.requestMagicLink(requestDto.email, requestDto.redirectUrl);

		return createApiResponse(
			HttpStatus.OK,
			'If the email exists, a magic link has been sent',
			null,
		);
	}

	@Get('magic-link/verify')
	async verifyMagicLink(
		@Query(new ZodValidationPipe(magicLinkVerifySchema)) verifyDto: MagicLinkVerifyDto,
		@Request() request: ExpressRequest,
		@Res() response: Response,
	): Promise<void> {
		const userDeviceInfo = this.sessionService.getSessionInfo(request);

		try {
			const result = await this.authService.verifyMagicLink(verifyDto, userDeviceInfo);

			response.cookie(
				'access-token',
				result.sessionToken,
				AppHelpers.accessTokenCookieConfig(this.configService),
			);

			if (result.user.is2faEnabled) {
				response.cookie(
					'requires-2fa',
					'true',
					AppHelpers.requires2faCookieConfig(this.configService),
				);
			} else {
				response.clearCookie(
					'requires-2fa',
					AppHelpers.requires2faClearCookieConfig(this.configService),
				);
			}

			await this.auditLogService.logAction({
				actor: result.user,
				action: 'LOGIN_SUCCESS',
				targetType: 'user',
				targetId: result.user.publicId,
				metadata: {
					method: 'magic_link',
					deviceName: userDeviceInfo.deviceName,
					deviceType: userDeviceInfo.deviceType,
				},
				request,
			});

			response.redirect(
				this.authService.getMagicLinkRedirectUrl(verifyDto.redirectUrl ?? verifyDto.redirect),
			);
		} catch (error) {
			const restriction = this.authPolicy.getDashboardAccessRestrictionFromError(error);

			if (!restriction) throw error;

			response.clearCookie(
				'access-token',
				AppHelpers.accessTokenClearCookieConfig(this.configService),
			);
			response.clearCookie(
				'requires-2fa',
				AppHelpers.requires2faClearCookieConfig(this.configService),
			);
			response.redirect(this.authPolicy.getDashboardAccessRestrictionLoginUrl(restriction));
		}
	}

	@Post('magic-link/verify')
	@HttpCode(HttpStatus.OK)
	async verifyMagicLinkJson(
		@Body(new ZodValidationPipe(magicLinkVerifySchema)) verifyDto: MagicLinkVerifyDto,
		@Request() request: ExpressRequest,
		@Res({ passthrough: true }) response: Response,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const userDeviceInfo = this.sessionService.getSessionInfo(request);
		const result = await this.authService.verifyMagicLink(verifyDto, userDeviceInfo);

		response.cookie(
			'access-token',
			result.sessionToken,
			AppHelpers.accessTokenCookieConfig(this.configService),
		);

		if (result.user.is2faEnabled) {
			response.cookie(
				'requires-2fa',
				'true',
				AppHelpers.requires2faCookieConfig(this.configService),
			);
		} else {
			response.clearCookie(
				'requires-2fa',
				AppHelpers.requires2faClearCookieConfig(this.configService),
			);
		}

		await this.auditLogService.logAction({
			actor: result.user,
			action: 'LOGIN_SUCCESS',
			targetType: 'user',
			targetId: result.user.publicId,
			metadata: {
				method: 'magic_link',
				deviceName: userDeviceInfo.deviceName,
				deviceType: userDeviceInfo.deviceType,
			},
			request,
		});

		return createApiResponse(
			HttpStatus.OK,
			'Magic link verified successfully',
			mapUserResponse(result.user),
		);
	}

	@UseGuards(PartialJwtAuthGuard)
	@Post('logout')
	@HttpCode(HttpStatus.OK)
	async logout(@Request() request: ExpressRequest): Promise<ApiResponse<null>> {
		const userId = request.user?.id;
		const sessionToken = request.cookies['access-token'] as string | undefined;

		if (!userId || !sessionToken) throw badRequestError('No active session found');

		await this.sessionService.revokeSession(userId, sessionToken);

		request.res?.clearCookie(
			'access-token',
			AppHelpers.accessTokenClearCookieConfig(this.configService),
		);

		request.res?.clearCookie(
			'requires-2fa',
			AppHelpers.requires2faClearCookieConfig(this.configService),
		);

		return createApiResponse(HttpStatus.OK, 'Logout successful', null);
	}

	@UseGuards(PartialJwtAuthGuard)
	@Get('2fa/status')
	async getTwoFactorStatus(
		@CurrentUser() user: UserWithoutPassword,
	): Promise<ApiResponse<TwoFactorStatusResponse>> {
		const status = await this.twoFactorService.getStatus(user);

		return createApiResponse(HttpStatus.OK, 'Two-factor status fetched successfully', status);
	}

	@UseGuards(PartialJwtAuthGuard)
	@Post('2fa/setup/start')
	@HttpCode(HttpStatus.OK)
	async startTwoFactorSetup(
		@CurrentUser() user: UserWithoutPassword,
	): Promise<ApiResponse<TwoFactorSetupStartResponse>> {
		const setup = await this.twoFactorService.startSetup(user);

		return createApiResponse(HttpStatus.OK, 'Two-factor setup started successfully', setup);
	}

	@UseGuards(PartialJwtAuthGuard)
	@Throttle({
		short: { limit: 3, ttl: 60000 },
		long: { limit: 10, ttl: 300000 },
	})
	@Post('2fa/setup/confirm')
	@HttpCode(HttpStatus.OK)
	async confirmTwoFactorSetup(
		@CurrentUser() user: UserWithoutPassword,
		@Request() request: PartialAuthRequest,
		@Body(new ZodValidationPipe(twoFactorCodeSchema)) body: TwoFactorCodeDto,
	): Promise<ApiResponse<TwoFactorRecoveryCodesResponse>> {
		const session = this.getPartialAuthSession(request);
		const result = await this.twoFactorService.confirmSetup(user, session, body.code);
		const userDeviceInfo = this.sessionService.getSessionInfo(request);

		await this.auditLogService.logAction({
			actor: user,
			action: '2FA_ENABLED',
			targetType: 'user',
			targetId: user.publicId,
			metadata: {
				recoveryCodeCount: result.recoveryCodes.length,
			},
			request,
		});
		await this.twoFactorAlertEmail.send({
			email: user.email,
			name: user.name,
			event: 'enabled',
			ipAddress: userDeviceInfo.ipAddress,
			userAgent: userDeviceInfo.userAgent,
		});

		return createApiResponse(HttpStatus.OK, 'Two-factor setup confirmed successfully', result);
	}

	@UseGuards(PartialJwtAuthGuard)
	@Throttle({
		short: { limit: 3, ttl: 60000 },
		long: { limit: 10, ttl: 300000 },
	})
	@Post('2fa/verify')
	@HttpCode(HttpStatus.OK)
	async verifyTwoFactor(
		@CurrentUser() user: UserWithoutPassword,
		@Request() request: PartialAuthRequest,
		@Body(new ZodValidationPipe(twoFactorCodeSchema)) body: TwoFactorCodeDto,
	): Promise<ApiResponse<TwoFactorVerifyResponse>> {
		const result = await this.twoFactorService.verifyTwoFactor(
			user,
			this.getPartialAuthSession(request),
			body.code,
		);

		request.res?.clearCookie(
			'requires-2fa',
			AppHelpers.requires2faClearCookieConfig(this.configService),
		);

		return createApiResponse(HttpStatus.OK, 'Two-factor verified successfully', result);
	}

	@UseGuards(JwtAuthGuard)
	@Throttle({
		short: { limit: 3, ttl: 60000 },
		long: { limit: 10, ttl: 300000 },
	})
	@Post('2fa/disable')
	@HttpCode(HttpStatus.OK)
	async disableTwoFactor(
		@CurrentUser() user: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(twoFactorCodeSchema)) body: TwoFactorCodeDto,
	): Promise<ApiResponse<TwoFactorDisableResponse>> {
		const sessionToken = this.getSessionToken(request);
		const session = await this.sessionService.validateSession(user.id, sessionToken);
		const wasTwoFactorEnabled = user.is2faEnabled;
		const result = await this.twoFactorService.disableTwoFactor(
			user,
			session,
			sessionToken,
			body.code,
		);
		const userDeviceInfo = this.sessionService.getSessionInfo(request);

		if (wasTwoFactorEnabled) {
			await this.auditLogService.logAction({
				actor: user,
				action: '2FA_DISABLED',
				targetType: 'user',
				targetId: user.publicId,
				metadata: {
					revokedOtherSessionCount: result.revokedOtherSessionCount,
					passwordRemoved: result.passwordRemoved,
				},
				request,
			});
			await this.twoFactorAlertEmail.send({
				email: user.email,
				name: user.name,
				event: 'disabled',
				ipAddress: userDeviceInfo.ipAddress,
				userAgent: userDeviceInfo.userAgent,
			});

		request.res?.clearCookie(
			'requires-2fa',
			AppHelpers.requires2faClearCookieConfig(this.configService),
		);

		if (result.passwordRemoved) {
			request.res?.clearCookie(
				'access-token',
				AppHelpers.accessTokenClearCookieConfig(this.configService),
			);
		}
		}

		const message = result.passwordRemoved
			? 'Two-factor disabled successfully. Your password has been removed and you have been logged out.'
			: 'Two-factor disabled successfully';

		return createApiResponse(HttpStatus.OK, message, result);
	}

	@UseGuards(JwtAuthGuard)
	@Throttle({
		short: { limit: 3, ttl: 60000 },
		long: { limit: 10, ttl: 300000 },
	})
	@Post('2fa/recovery-codes/regenerate')
	@HttpCode(HttpStatus.OK)
	async regenerateTwoFactorRecoveryCodes(
		@CurrentUser() user: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(twoFactorCodeSchema)) body: TwoFactorCodeDto,
	): Promise<ApiResponse<TwoFactorRecoveryCodesResponse>> {
		const session = await this.getCurrentSession(user, request);
		const result = await this.twoFactorService.regenerateRecoveryCodes(user, session, body.code);

		return createApiResponse(
			HttpStatus.OK,
			'Two-factor recovery codes regenerated successfully',
			result,
		);
	}

	@UseGuards(JwtAuthGuard)
	@Get('me')
	getProfile(@CurrentUser() user: UserWithoutPassword): ApiResponse<UserWithoutPasswordResponse> {
		return createApiResponse(
			HttpStatus.OK,
			'User profile fetched successfully',
			mapUserResponse(user),
		);
	}

	@UseGuards(JwtAuthGuard)
	@Get('sessions')
	async getSessions(
		@CurrentUser() user: UserWithoutPassword,
		@Query(new ZodValidationPipe(sessionListQuerySchema)) query: SessionListQueryDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<SessionListResponse>> {
		const sessionToken = request.cookies['access-token'] as string | undefined;

		if (!sessionToken) throw badRequestError('No active session found');

		const sessions = await this.sessionService.listUserSessions(user.id, query, sessionToken);

		return createApiResponse(HttpStatus.OK, 'Sessions fetched successfully', sessions);
	}

	@UseGuards(JwtAuthGuard)
	@Post('sessions/revoke-others')
	@HttpCode(HttpStatus.OK)
	async revokeOtherSessions(
		@CurrentUser() user: UserWithoutPassword,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<{ revokedCount: number }>> {
		const sessionToken = request.cookies['access-token'] as string | undefined;

		if (!sessionToken) throw badRequestError('No active session found');

		const revokedCount = await this.sessionService.revokeOtherUserSessions(user.id, sessionToken);

		return createApiResponse(HttpStatus.OK, 'Other sessions revoked successfully', {
			revokedCount,
		});
	}

	@UseGuards(JwtAuthGuard)
	@Post('sessions/:id/revoke')
	@HttpCode(HttpStatus.OK)
	async revokeSession(
		@CurrentUser() user: UserWithoutPassword,
		@Param('id', ParseUUIDPipe) id: string,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<SessionResponse>> {
		const sessionToken = request.cookies['access-token'] as string | undefined;

		if (!sessionToken) throw badRequestError('No active session found');

		const revokedSession = await this.sessionService.revokeUserSession(user.id, id);

		if (revokedSession.token === sessionToken) {
			request.res?.clearCookie(
				'access-token',
				AppHelpers.accessTokenClearCookieConfig(this.configService),
			);
			request.res?.clearCookie(
				'requires-2fa',
				AppHelpers.requires2faClearCookieConfig(this.configService),
			);
		}

		return createApiResponse(
			HttpStatus.OK,
			'Session revoked successfully',
			mapSessionResponse(revokedSession, sessionToken),
		);
	}

	@UseGuards(JwtAuthGuard)
	@Put('profile')
	async updateProfile(
		@Body(new ZodValidationPipe(updateProfileSchema)) updateData: UpdateProfileDto,
		@CurrentUser() user: UserWithoutPassword,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const updatedUser = await this.authService.updateUser(user.id, updateData);

		return createApiResponse(
			HttpStatus.OK,
			'Profile updated successfully',
			mapUserResponse(updatedUser),
		);
	}

	@UseGuards(JwtAuthGuard)
	@Put('profile/image')
	@UseInterceptors(
		FileInterceptor('avatar', {
			storage: memoryStorage(),
			limits: { fileSize: FILE_SIZE_LIMIT },
		}),
	)
	async uploadMedia(
		@UploadedFile(new ZodFileValidationPipe(singleFileSchema))
		file: Express.Multer.File,
		@CurrentUser() user: UserWithoutPassword,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const updatedUser = await this.authService.updateUserProfileImage(user.id, file);

		return createApiResponse(
			HttpStatus.OK,
			'Media uploaded successfully',
			mapUserResponse(updatedUser),
		);
	}

	@UseGuards(BruteForceGuard)
	@Throttle({
		short: { limit: 3, ttl: 60000 },
		long: { limit: 10, ttl: 300000 },
	})
	@Post('login')
	@HttpCode(HttpStatus.OK)
	async passwordLogin(
		@Body(new ZodValidationPipe(passwordLoginSchema)) loginDto: PasswordLoginDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const ip = this.extractClientIp(request);

		try {
			const user = await this.authService.validateUser(loginDto);
			const userDeviceInfo = this.sessionService.getSessionInfo(request);

			await this.authPolicy.assertCanAccessDashboard(user);

			const accessToken = await this.authService.generateAccessToken({
				userId: user.id,
				email: user.email,
				userAgent: userDeviceInfo.userAgent,
				ipAddress: userDeviceInfo.ipAddress,
				deviceName: userDeviceInfo.deviceName,
				deviceType: userDeviceInfo.deviceType,
			});

			request.res?.cookie(
				'access-token',
				accessToken,
				AppHelpers.accessTokenCookieConfig(this.configService),
			);

			if (user.is2faEnabled) {
				request.res?.cookie(
					'requires-2fa',
					'true',
					AppHelpers.requires2faCookieConfig(this.configService),
				);
			} else {
				request.res?.clearCookie(
					'requires-2fa',
					AppHelpers.requires2faClearCookieConfig(this.configService),
				);
			}

			// Clear brute-force tracking on successful login
			await BruteForceGuard.clearFailedAttempts(this.securityStore, loginDto.email, ip);

			await this.auditLogService.logAction({
				actor: user,
				action: 'LOGIN_SUCCESS',
				targetType: 'user',
				targetId: user.publicId,
				metadata: {
					method: 'password',
					deviceName: userDeviceInfo.deviceName,
					deviceType: userDeviceInfo.deviceType,
				},
				request,
			});

			return createApiResponse(HttpStatus.OK, 'Login successful', mapUserResponse(user));
		} catch (error) {
			// Record failed login attempt for brute-force tracking
			await BruteForceGuard.recordFailedAttempt(
				this.securityStore,
				this.configService,
				loginDto.email,
				ip,
			);
			throw error;
		}
	}

	@UseGuards(JwtAuthGuard, TwoFaRequiredGuard)
	@Throttle({
		short: { limit: 3, ttl: 60000 },
		long: { limit: 10, ttl: 300000 },
	})
	@Post('password/set')
	@HttpCode(HttpStatus.OK)
	async setPassword(
		@CurrentUser() user: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(setPasswordSchema)) body: SetPasswordDto,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const updatedUser = await this.authService.setPassword(user.id, body.password, true);

		await this.auditLogService.logAction({
			actor: user,
			action: 'PASSWORD_SET',
			targetType: 'user',
			targetId: user.publicId,
			request,
		});

		return createApiResponse(
			HttpStatus.OK,
			'Password set successfully',
			mapUserResponse(updatedUser),
		);
	}

	@UseGuards(JwtAuthGuard, TwoFaRequiredGuard)
	@Throttle({
		short: { limit: 3, ttl: 60000 },
		long: { limit: 10, ttl: 300000 },
	})
	@Post('password/change')
	@HttpCode(HttpStatus.OK)
	async changePassword(
		@CurrentUser() user: UserWithoutPassword,
		@Request() request: ExpressRequest,
		@Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordDto,
	): Promise<ApiResponse<null>> {
		await this.authService.changePassword(user.id, body.currentPassword, body.newPassword);

		await this.auditLogService.logAction({
			actor: user,
			action: 'PASSWORD_CHANGED',
			targetType: 'user',
			targetId: user.publicId,
			request,
		});

		return createApiResponse(HttpStatus.OK, 'Password changed successfully', null);
	}

	@UseGuards(BruteForceGuard)
	@Post('google')
	@HttpCode(HttpStatus.OK)
	async googleLogin(
		@Body(new ZodValidationPipe(googleLoginSchema)) googleLoginDto: GoogleLoginDto,
		@Request() request: ExpressRequest,
	): Promise<ApiResponse<UserWithoutPasswordResponse>> {
		const ip = this.extractClientIp(request);

		try {
			const googleProfile = await this.authService.verifyGoogleCredential(
				googleLoginDto.credential,
			);
			const user = await this.authService.findOrCreateGoogleUser(googleProfile);
			const userDeviceInfo = this.sessionService.getSessionInfo(request);

			await this.authPolicy.assertCanAccessDashboard(user);

			const accessToken = await this.authService.generateAccessToken({
				userId: user.id,
				email: user.email,
				userAgent: userDeviceInfo.userAgent,
				ipAddress: userDeviceInfo.ipAddress,
				deviceName: userDeviceInfo.deviceName,
				deviceType: userDeviceInfo.deviceType,
			});

			request.res?.cookie(
				'access-token',
				accessToken,
				AppHelpers.accessTokenCookieConfig(this.configService),
			);

			if (user.is2faEnabled) {
				request.res?.cookie(
					'requires-2fa',
					'true',
					AppHelpers.requires2faCookieConfig(this.configService),
				);
			} else {
				request.res?.clearCookie(
					'requires-2fa',
					AppHelpers.requires2faClearCookieConfig(this.configService),
				);
			}

			// Clear brute-force tracking on successful login
			await BruteForceGuard.clearFailedAttempts(this.securityStore, user.email, ip);

			await this.auditLogService.logAction({
				actor: user,
				action: 'LOGIN_SUCCESS',
				targetType: 'user',
				targetId: user.publicId,
				metadata: {
					method: 'google',
					deviceName: userDeviceInfo.deviceName,
					deviceType: userDeviceInfo.deviceType,
				},
				request,
			});

			return createApiResponse(HttpStatus.OK, 'Google login successful', mapUserResponse(user));
		} catch (error) {
			// Record failed login attempt for brute-force tracking (by IP only for OAuth)
			await BruteForceGuard.recordFailedAttempt(
				this.securityStore,
				this.configService,
				'oauth_attempt',
				ip,
			);
			throw error;
		}
	}

	private getSessionToken(request: ExpressRequest): string {
		const sessionToken = request.cookies['access-token'] as string | undefined;

		if (!sessionToken) throw badRequestError('No active session found');

		return sessionToken;
	}

	private getCurrentSession(user: UserWithoutPassword, request: ExpressRequest) {
		return this.sessionService.validateSession(user.id, this.getSessionToken(request));
	}

	private getPartialAuthSession(request: PartialAuthRequest) {
		if (!request.authSession) throw badRequestError('No active session found');

		return request.authSession;
	}

	private extractClientIp(request: ExpressRequest): string {
		const forwardedFor = request.headers['x-forwarded-for'] as string | undefined;
		const realIp = request.headers['x-real-ip'] as string | undefined;

		if (forwardedFor) {
			return forwardedFor.split(',')[0].trim();
		}

		if (realIp) {
			return realIp.trim();
		}

		const rawIp = request.ip || request.connection?.remoteAddress || '';
		return typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : String(rawIp);
	}
}
