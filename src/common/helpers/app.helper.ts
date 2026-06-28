import type { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import type { CookieOptions } from 'express';
import { badRequestError } from '../../core/errors/domain-error';
import type { EnvType } from '../../core/validators/env';
import { sessionTimeout } from './constant.helper';

interface SameSiteCookieConfig {
	sameSite: 'strict' | 'lax' | 'none';
	secure: boolean;
	domain?: string;
}

export const AppHelpers = {
	/**
	 * Determines if the input is an email or a username.
	 * @param input - The user-provided input.
	 * @returns "email" if the input is an email, "username" otherwise.
	 */
	detectInputType(input: string): 'EMAIL' | 'USERNAME' {
		// Regular expression to validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(input) ? 'EMAIL' : 'USERNAME';
	},

	/**
	 * Generates a random OTP of the specified length.
	 * @param length - The length of the OTP to generate.
	 * @returns The generated OTP.
	 * @throws An error if the length is less than 4.
	 */
	OTPGenerator(length: number = 4): string {
		if (length < 4) {
			throw badRequestError('The OTP length must be at least 4.');
		}

		const min = Math.pow(10, length - 1);
		const max = Math.pow(10, length) - 1;
		return String(randomInt(min, max + 1));
	},

	/**
	 * Generate OTP expiry time.
	 * @param expiryTime - The expiry time in minutes.
	 * @returns The expiry time in Date format.
	 */
	OTPExpiry(expiryTime: number = 5): Date {
		const now = new Date();
		return new Date(now.getTime() + expiryTime * 60000);
	},

	/**
	 * Determines the appropriate SameSite and secure settings for cookies based on environment variables.
	 * @param configService - NestJS ConfigService instance
	 * @returns The SameSite and secure settings for cookies.
	 */
	sameSiteCookieConfig(configService: ConfigService<EnvType, true>): SameSiteCookieConfig {
		const sameSite = configService.get('COOKIE_SAME_SITE', { infer: true });
		const secure = configService.get<string>('COOKIE_SECURE') === 'true';
		const domain = configService.get<string>('COOKIE_DOMAIN');

		const config: SameSiteCookieConfig = {
			sameSite,
			secure,
		};

		if (domain) {
			config.domain = domain;
		}

		return config;
	},

	accessTokenCookieConfig(
		configService: ConfigService<EnvType, true>,
		maxAge: number = sessionTimeout,
	): CookieOptions {
		const cookieConfig = this.sameSiteCookieConfig(configService);

		return {
			httpOnly: true,
			secure: cookieConfig.secure,
			sameSite: cookieConfig.sameSite,
			maxAge,
			...(cookieConfig.domain && {
				domain: cookieConfig.domain,
			}),
		};
	},

	accessTokenClearCookieConfig(configService: ConfigService<EnvType, true>): CookieOptions {
		const cookieConfig = this.sameSiteCookieConfig(configService);

		return {
			httpOnly: true,
			secure: cookieConfig.secure,
			sameSite: cookieConfig.sameSite,
			...(cookieConfig.domain && {
				domain: cookieConfig.domain,
			}),
		};
	},

	requires2faCookieConfig(
		configService: ConfigService<EnvType, true>,
		maxAge: number = sessionTimeout,
	): CookieOptions {
		const cookieConfig = this.sameSiteCookieConfig(configService);

		return {
			httpOnly: true,
			secure: cookieConfig.secure,
			sameSite: cookieConfig.sameSite,
			maxAge,
			path: '/',
			...(cookieConfig.domain && {
				domain: cookieConfig.domain,
			}),
		};
	},

	requires2faClearCookieConfig(configService: ConfigService<EnvType, true>): CookieOptions {
		const cookieConfig = this.sameSiteCookieConfig(configService);

		return {
			httpOnly: true,
			secure: cookieConfig.secure,
			sameSite: cookieConfig.sameSite,
			path: '/',
			...(cookieConfig.domain && {
				domain: cookieConfig.domain,
			}),
		};
	},
} as const;
