import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { twoFactorRequiredError, unauthorizedError } from '../../../core/errors/domain-error';
import { AppHelpers } from '../../../common/helpers/app.helper';
import { EnvType } from '../../../core/validators/env';
import { CryptoService } from '../../../core/crypto/crypto.service';
import { AuthPolicy } from '../auth.policy';
import { AuthService } from '../auth.service';
import { SessionService } from '../session/session.service';

interface JwtPayload {
	sub: number;
	email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private readonly configService: ConfigService<EnvType, true>,
		private readonly authService: AuthService,
		private readonly authPolicy: AuthPolicy,
		private readonly sessionService: SessionService,
		private readonly cryptoService: CryptoService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(request: Request) => {
					return request?.cookies?.['access-token'] as string | null;
				},
			]),
			// Session validity is enforced from the database so active users can keep their session alive.
			ignoreExpiration: true,
			secretOrKey: configService.get('AUTH_SECRET', { infer: true }),
			passReqToCallback: true,
		});
	}

	async validate(request: Request, payload: JwtPayload): Promise<Express.User> {
		// Access the JWT token from the request
		const jwtToken = request.cookies?.['access-token'] as string;

		if (!jwtToken) throw unauthorizedError('Unauthorized');

		// Decrypt the user ID
		const decryptedUserId = this.cryptoService.decrypt(payload.sub.toString());
		payload.sub = parseInt(decryptedUserId, 10);

		// Fetch full user from database using AuthService
		const user = await this.authService.findUserById(payload.sub);

		if (!user.emailVerified) throw unauthorizedError('Email not verified');

		await this.authPolicy.assertCanAccessDashboard(user);

		// Check if the user session is valid
		const session = await this.sessionService.validateSession(user.id, jwtToken);

		// If user has 2FA enabled, verify the session has completed 2FA
		if (user.is2faEnabled && !session.twoFactorVerified) {
			throw twoFactorRequiredError('Please complete 2FA verification to access this resource.');
		}

		if (this.sessionService.shouldExtendSession(session)) {
			await this.sessionService.extendSession(session.id);
			request.res?.cookie(
				'access-token',
				jwtToken,
				AppHelpers.accessTokenCookieConfig(this.configService),
			);
		}

		return user;
	}
}
