import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { UploadApiResponse } from 'cloudinary';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

import { magicLinkTimeout, sessionTimeout } from '../../common/helpers/constant.helper';
import { CryptoService } from '../../core/crypto/crypto.service';
import { badRequestError, notFoundError, unauthorizedError } from '../../core/errors/domain-error';
import { EnvType } from '../../core/validators/env';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CloudinaryImageService } from '../media/services/cloudinary.service';
import { SystemService } from '../system/system.service';
import { stripUserPassword } from './auth.mapper';
import { AuthPolicy } from './auth.policy';
import { AUTH_CLOUDINARY_SERVICE } from './auth.providers';
import { AuthRepository, type AuthDbClient } from './auth.repository';
import type {
	CreateUser,
	MagicLinkSessionInfo,
	UserInformation,
	UserWithoutPassword,
	VerifiedGoogleProfile,
} from './auth.types';
import { MagicLinkEmail } from './emails/magic-link.email';
import { WelcomeEmail } from './emails/welcome.email';
import type { LoginDto, UpdateProfileDto } from './schemas/auth.schema';
import { SessionService } from './session/session.service';

@Injectable()
export class AuthService {
	private readonly googleAuthClient = new OAuth2Client();

	constructor(
		private readonly authRepository: AuthRepository,
		private readonly jwtService: JwtService,
		private readonly sessionService: SessionService,
		private readonly cryptoService: CryptoService,
		private readonly magicLinkEmail: MagicLinkEmail,
		private readonly welcomeEmail: WelcomeEmail,
		private readonly auditLogService: AuditLogService,
		@Inject(AUTH_CLOUDINARY_SERVICE)
		private readonly cloudinaryImageService: CloudinaryImageService,
		private readonly configService: ConfigService<EnvType, true>,
		private readonly systemService: SystemService,
		private readonly authPolicy: AuthPolicy,
	) {}

	async generateAccessToken(userInfo: UserInformation): Promise<string> {
		const sub = this.cryptoService.encrypt(userInfo.userId.toString());
		const email = this.cryptoService.encrypt(userInfo.email);

		const payload = { sub, email };
		const token = this.jwtService.sign(payload);

		return this.sessionService.createSession({
			userId: userInfo.userId,
			expiresAt: userInfo.expirationTime
				? new Date(userInfo.expirationTime)
				: new Date(Date.now() + sessionTimeout),
			userAgent: userInfo.userAgent,
			ipAddress: userInfo.ipAddress,
			deviceName: userInfo.deviceName,
			deviceType: userInfo.deviceType,
			token,
		});
	}

	async requestMagicLink(email: string, redirectUrl?: string | null): Promise<void> {
		const normalizedEmail = this.normalizeEmail(email);

		// Check if access model is CLOSED and user does not exist
		const settings = await this.systemService.getSettings();
		if (settings.accessModel === 'CLOSED') {
			const userExists = await this.checkIfUserExists(normalizedEmail);
			if (!userExists) {
				throw badRequestError('Registration is closed. Only pre-created accounts can sign in.');
			}
		}

		const token = randomBytes(32).toString('hex');
		const tokenHash = this.cryptoService.hash(token);
		const expiresAt = new Date(Date.now() + magicLinkTimeout);
		const safeRedirectUrl = this.resolveSafeMagicLinkRedirectUrl(redirectUrl);

		await this.authRepository.transaction(async tx => {
			await this.authRepository.deleteVerificationsByIdentifier(normalizedEmail, tx);
			await this.authRepository.createVerification(
				{
					identifier: normalizedEmail,
					value: tokenHash,
					expiresAt,
				},
				tx,
			);
		});

		try {
			await this.magicLinkEmail.send({
				email: normalizedEmail,
				verificationUrl: this.buildMagicLinkVerificationUrl(
					normalizedEmail,
					token,
					safeRedirectUrl,
				),
				redirectUrl: this.buildMagicLinkRedirectUrl(safeRedirectUrl),
			});
		} catch (error) {
			await this.authRepository.deleteVerificationByIdentifierValue(normalizedEmail, tokenHash);

			throw error;
		}
	}

	getMagicLinkRedirectUrl(redirectUrl?: string | null): string {
		return this.buildMagicLinkRedirectUrl(this.resolveSafeMagicLinkRedirectUrl(redirectUrl));
	}

	async verifyMagicLink(
		input: { email: string; token: string },
		sessionInfo: MagicLinkSessionInfo,
	): Promise<{ user: UserWithoutPassword; sessionToken: string }> {
		const normalizedEmail = this.normalizeEmail(input.email);
		const tokenHash = this.cryptoService.hash(input.token);

		const provisioning = await this.authRepository.transaction(async tx => {
			const verification = await this.authRepository.findVerification(
				normalizedEmail,
				tokenHash,
				tx,
			);

			if (!verification) {
				throw unauthorizedError('Invalid or expired magic link');
			}

			if (verification.expiresAt < new Date()) {
				await this.authRepository.deleteVerificationByIdentifierValue(
					normalizedEmail,
					tokenHash,
					tx,
				);

				throw unauthorizedError('Magic link has expired');
			}

			const userRecord = await this.findOrProvisionMagicLinkUser(tx, normalizedEmail);

			await this.authRepository.deleteVerificationsByIdentifier(normalizedEmail, tx);

			return userRecord;
		});
		const user = provisioning.user;

		if (provisioning.created) {
			await this.welcomeEmail.send({
				email: user.email,
				name: user.name,
			});
			await this.auditLogService.logAction({
				actor: null,
				action: 'USER_PROVISIONED',
				targetType: 'user',
				targetId: user.publicId,
				metadata: {
					provider: 'magic_link',
					email: user.email,
					role: user.role,
					isApproved: user.isApproved,
				},
			});
		}

		await this.authPolicy.assertCanAccessDashboard(user);

		const sessionToken = await this.generateAccessToken({
			userId: user.id,
			email: user.email,
			...sessionInfo,
		});

		return {
			user,
			sessionToken,
		};
	}

	async findUserById(id: number): Promise<UserWithoutPassword> {
		const user = await this.authRepository.findUserById(id);

		if (!user) throw notFoundError('user_not_found', 'User not found');

		return stripUserPassword(user);
	}

	async findUserByPublicId(publicId: string): Promise<UserWithoutPassword> {
		const user = await this.authRepository.findUserByPublicId(publicId);

		if (!user) throw notFoundError('user_not_found', 'User not found');

		return stripUserPassword(user);
	}

	async findUserByEmail(email: string): Promise<UserWithoutPassword> {
		const user = await this.authRepository.findUserByEmail(email);

		if (!user) throw notFoundError('user_not_found', 'User not found');

		return stripUserPassword(user);
	}

	async checkIfUserExists(email: string): Promise<boolean> {
		const user = await this.authRepository.findUserByEmail(email);

		return !!user;
	}

	async validateUser(data: LoginDto): Promise<UserWithoutPassword> {
		const user = await this.authRepository.findUserByEmail(data.email);

		if (!user) throw badRequestError('User with this email does not exist');

		if (!user.emailVerified) throw unauthorizedError('Email not verified');

		if (!user.password) throw unauthorizedError('User does not have a password set');

		const isPasswordValid = await bcrypt.compare(data.password, user.password);

		if (!isPasswordValid) throw unauthorizedError('Invalid credentials');

		return stripUserPassword(user);
	}

	async createUser(data: CreateUser): Promise<UserWithoutPassword> {
		let hashedPassword: string | undefined = undefined;
		if (data.password) hashedPassword = await bcrypt.hash(data.password, 10);

		let imageUrl: string | null = null;
		let imageInformation: UploadApiResponse | null | undefined = null;

		if (data.image) {
			if (this.configService.get('CLOUDINARY_ENABLED') === 'true') {
				const uploadResult = await this.cloudinaryImageService.uploadFromGoogleUrl(data.image, {
					folder: 'user_profiles',
					transformation: {
						quality: 'auto',
						format: 'webp',
						width: 500,
						height: 500,
						crop: 'fill',
					},
				});

				imageUrl = String(uploadResult.data?.secure_url);
				imageInformation = uploadResult.data;
			} else {
				imageUrl = data.image;
				imageInformation = null;
			}
		}

		const newUser = await this.authRepository.createUser({
			...data,
			image: imageUrl,
			imageInformation,
			password: hashedPassword,
		});

		return stripUserPassword(newUser);
	}

	async updateUser(
		userId: number,
		data: UpdateProfileDto & { imageInformation?: UploadApiResponse | null },
	): Promise<UserWithoutPassword> {
		const updatedUser = await this.authRepository.updateUser(userId, data);

		return stripUserPassword(updatedUser);
	}

	async setPassword(
		userId: number,
		password: string,
		requireNoPassword = false,
	): Promise<UserWithoutPassword> {
		const existingUser = await this.authRepository.findUserById(userId);
		if (!existingUser) throw notFoundError('user_not_found', 'User not found');
		if (requireNoPassword && existingUser.password)
			throw badRequestError('Password is already set');

		this.validatePasswordStrength(password);

		const hashedPassword = await bcrypt.hash(password, 10);
		const updatedUser = await this.authRepository.updateUser(userId, { password: hashedPassword });

		return stripUserPassword(updatedUser);
	}

	async changePassword(
		userId: number,
		currentPassword: string,
		newPassword: string,
	): Promise<void> {
		const existingUser = await this.authRepository.findUserById(userId);
		if (!existingUser) throw notFoundError('user_not_found', 'User not found');
		if (!existingUser.password) throw unauthorizedError('Password is not set');

		const isCurrentValid = await bcrypt.compare(currentPassword, existingUser.password);
		if (!isCurrentValid) throw unauthorizedError('Current password is incorrect');

		this.validatePasswordStrength(newPassword);

		const hashedPassword = await bcrypt.hash(newPassword, 10);
		await this.authRepository.updateUser(userId, { password: hashedPassword });
	}

	async removePassword(userId: number): Promise<boolean> {
		const existingUser = await this.authRepository.findUserById(userId);
		if (!existingUser) throw notFoundError('user_not_found', 'User not found');
		if (!existingUser.password) return false;

		await this.authRepository.removePassword(userId);
		return true;
	}

	async updateUserProfileImage(
		userId: number,
		file: Express.Multer.File,
	): Promise<UserWithoutPassword> {
		if (this.configService.get('CLOUDINARY_ENABLED') !== 'true') {
			throw badRequestError(
				'Profile image upload is disabled because Cloudinary is not configured.',
			);
		}

		const result = await this.cloudinaryImageService.uploadWithFaceDetection(file.buffer, {
			size: 200,
			gravity: 'face:auto',
		});

		if (!result.success || !result.data) {
			throw badRequestError('Failed to upload image');
		}

		const currentUser = await this.findUserById(userId);
		if (currentUser.imageInformation && currentUser.imageInformation.public_id) {
			await this.cloudinaryImageService.deleteMedia(currentUser.imageInformation.public_id);
		}

		return this.updateUser(userId, {
			image: result.data.secure_url,
			imageInformation: result.data,
		});
	}

	async verifyGoogleCredential(credential: string): Promise<VerifiedGoogleProfile> {
		if (this.configService.get('GOOGLE_LOGIN_ENABLED') !== 'true') {
			throw unauthorizedError('Google login is disabled.');
		}
		try {
			const ticket = await this.googleAuthClient.verifyIdToken({
				idToken: credential,
				audience: this.configService.get('GOOGLE_CLIENT_ID'),
			});

			const payload = ticket.getPayload();

			if (!payload?.sub || !payload.email) {
				throw unauthorizedError('Invalid Google credential');
			}

			if (payload.email_verified !== true) {
				throw unauthorizedError('Google account email is not verified');
			}

			return {
				email: payload.email,
				name: payload.name ?? null,
				picture: payload.picture ?? null,
				googleId: payload.sub,
				emailVerified: payload.email_verified,
			};
		} catch (error) {
			if (error instanceof Error && 'status' in error) {
				throw error;
			}

			throw unauthorizedError('Google authentication failed. Please try again.');
		}
	}

	async findOrCreateGoogleUser(profile: VerifiedGoogleProfile): Promise<UserWithoutPassword> {
		const existingAccount = await this.authRepository.findAccountByProvider(
			'google',
			profile.googleId,
		);

		if (existingAccount) {
			return this.findUserById(existingAccount.userId);
		}

		const existingUser = await this.authRepository.findUserByEmail(profile.email);

		if (existingUser) {
			await this.authRepository.createAccountLink({
				accountId: profile.googleId,
				providerId: 'google',
				userId: existingUser.id,
			});

			return stripUserPassword(existingUser);
		}

		const settings = await this.systemService.getSettings();
		if (settings.accessModel === 'CLOSED') {
			throw unauthorizedError('Registration is closed. Only pre-created accounts can sign in.');
		}

		const isApproved = settings.accessModel !== 'APPROVAL_BASED';

		const newUser = await this.createUser({
			name: profile.name,
			email: profile.email,
			password: null,
			image: profile.picture,
			imageInformation: null,
			emailVerified: profile.emailVerified,
			phone: null,
			role: 'USER',
			isApproved,
		});

		await this.authRepository.createAccountLink({
			accountId: profile.googleId,
			providerId: 'google',
			userId: newUser.id,
		});

		await this.welcomeEmail.send({
			email: newUser.email,
			name: newUser.name,
		});
		await this.auditLogService.logAction({
			actor: null,
			action: 'USER_PROVISIONED',
			targetType: 'user',
			targetId: newUser.publicId,
			metadata: {
				provider: 'google',
				email: newUser.email,
				role: newUser.role,
				isApproved: newUser.isApproved,
			},
		});

		return newUser;
	}

	private normalizeEmail(email: string): string {
		return email.trim().toLowerCase();
	}

	private buildMagicLinkVerificationUrl(
		email: string,
		token: string,
		redirectUrl?: string | null,
	): string {
		const appUrl = this.configService.get('APP_URL', { infer: true });
		const url = new URL('/auth/magic-link/verify', appUrl);
		url.searchParams.set('email', email);
		url.searchParams.set('token', token);
		if (redirectUrl) url.searchParams.set('redirect', redirectUrl);
		return url.toString();
	}

	private buildMagicLinkRedirectUrl(redirectUrl?: string | null): string {
		const appUrl = this.configService.get('APP_URL', { infer: true });
		const url = new URL('/auth/magic-link/success', appUrl);
		if (redirectUrl) url.searchParams.set('redirect', redirectUrl);
		return url.toString();
	}

	private resolveSafeMagicLinkRedirectUrl(redirectUrl?: string | null): string | null {
		if (!redirectUrl) return null;

		try {
			const appUrl = new URL(this.configService.get('APP_URL', { infer: true }));
			const parsed = new URL(redirectUrl, appUrl);

			if (parsed.origin !== appUrl.origin) return null;

			return parsed.toString();
		} catch {
			return null;
		}
	}

	private async findOrProvisionMagicLinkUser(
		db: AuthDbClient,
		email: string,
	): Promise<{ user: UserWithoutPassword; created: boolean }> {
		const existingUser = await this.authRepository.findUserByEmail(email, db);

		if (existingUser) {
			const user = existingUser.emailVerified
				? existingUser
				: await this.authRepository.markUserEmailVerified(existingUser.id, db);

			if (!user) throw notFoundError('user_not_found', 'User not found');

			return {
				user: stripUserPassword(user),
				created: false,
			};
		}

		const settings = await this.systemService.getSettings();
		if (settings.accessModel === 'CLOSED') {
			throw unauthorizedError('Registration is closed. Only pre-created accounts can sign in.');
		}

		const isApproved = settings.accessModel !== 'APPROVAL_BASED';

		const newUser = await this.authRepository.createMagicLinkUser(email, isApproved, db);

		return {
			user: stripUserPassword(newUser),
			created: true,
		};
	}

	/**
	 * Validates password strength against the configured policy.
	 *
	 * The Zod schema already enforces: uppercase, lowercase, number, special char, min 8.
	 * This method adds a runtime check for the configurable PASSWORD_MIN_LENGTH env var,
	 * which may be set higher than the Zod default of 8.
	 */
	private validatePasswordStrength(password: string): void {
		const minLength = this.configService.get('PASSWORD_MIN_LENGTH', { infer: true });

		if (password.length < minLength) {
			throw badRequestError(`Password must be at least ${minLength} characters long`);
		}
	}
}
