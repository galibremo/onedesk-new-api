import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { unauthorizedError } from '../../../core/errors/domain-error';
import { AppHelpers } from '../../../common/helpers/app.helper';
import { EnvType } from '../../../core/validators/env';
import { CryptoService } from '../../../core/crypto/crypto.service';
import type { SessionSchemaType } from '../../../core/database/types';
import { AuthService } from '../auth.service';
import { SessionService } from '../session/session.service';

interface JwtPayload {
	sub: number;
	email: string;
}

export type PartialAuthRequest = Request & {
	authSession?: SessionSchemaType;
};

@Injectable()
export class JwtPartialStrategy extends PassportStrategy(Strategy, 'jwt-partial') {
	constructor(
		private readonly configService: ConfigService<EnvType, true>,
		private readonly authService: AuthService,
		private readonly sessionService: SessionService,
		private readonly cryptoService: CryptoService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(request: Request) => {
					return request?.cookies?.['access-token'] as string | null;
				},
			]),
			ignoreExpiration: true,
			secretOrKey: configService.get('AUTH_SECRET', { infer: true }),
			passReqToCallback: true,
		});
	}

	async validate(request: PartialAuthRequest, payload: JwtPayload): Promise<Express.User> {
		const jwtToken = request.cookies?.['access-token'] as string;

		if (!jwtToken) throw unauthorizedError('Unauthorized');

		const decryptedUserId = this.cryptoService.decrypt(payload.sub.toString());
		payload.sub = parseInt(decryptedUserId, 10);

		const user = await this.authService.findUserById(payload.sub);

		if (!user.emailVerified) throw unauthorizedError('Email not verified');

		const session = await this.sessionService.validateSession(user.id, jwtToken);
		request.authSession = session;

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
