import {
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
	Logger,
	HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { EnvType } from '../../core/validators/env';
import { SECURITY_STORE_TOKEN, type ISecurityStore } from '../../core/security-store';
import { DomainError } from '../../core/errors/domain-error';
import { extractIp } from '../helpers/ip.helper';

export class TooManyLoginAttemptsError extends DomainError {
	constructor(message: string) {
		super('too_many_login_attempts', message, HttpStatus.TOO_MANY_REQUESTS);
	}
}

@Injectable()
export class BruteForceGuard implements CanActivate {
	private readonly logger = new Logger(BruteForceGuard.name);

	constructor(
		@Inject(SECURITY_STORE_TOKEN)
		private readonly store: ISecurityStore,
		private readonly configService: ConfigService<EnvType, true>,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const trustProxy = this.configService.get('TRUST_PROXY', { infer: true }) === 'true';
		const ip = extractIp(request, trustProxy);

		if (!ip) {
			this.logger.warn('Could not extract client IP for brute-force check, allowing request');
			return true;
		}

		const lockoutMinutes = this.configService.get('LOGIN_LOCKOUT_MINUTES', { infer: true });

		const ipLockoutKey = `login:ip:${ip}`;
		const isIpLocked = await this.store.isLockedOut(ipLockoutKey);

		if (isIpLocked) {
			this.logger.warn(`Brute-force lockout: IP ${ip} is locked out for ${lockoutMinutes} minutes`);
			throw new TooManyLoginAttemptsError(
				`Too many failed login attempts. Please try again in ${lockoutMinutes} minutes.`,
			);
		}

		const email = (request.body as Record<string, unknown> | undefined)?.email as string | undefined;
		if (email) {
			const normalizedEmail = email.trim().toLowerCase();
			const emailLockoutKey = `login:email:${normalizedEmail}`;
			const isEmailLocked = await this.store.isLockedOut(emailLockoutKey);

			if (isEmailLocked) {
				this.logger.warn(`Brute-force lockout: email ${normalizedEmail} is locked out for ${lockoutMinutes} minutes`);
				throw new TooManyLoginAttemptsError(
					`Too many failed login attempts. Please try again in ${lockoutMinutes} minutes.`,
				);
			}
		}

		return true;
	}

	static async recordFailedAttempt(
		store: ISecurityStore,
		configService: ConfigService<EnvType, true>,
		email: string,
		ip: string,
	): Promise<void> {
		const maxAttempts = configService.get('LOGIN_MAX_FAILED_ATTEMPTS', { infer: true });
		const lockoutMinutes = configService.get('LOGIN_LOCKOUT_MINUTES', { infer: true });
		const lockoutMs = lockoutMinutes * 60 * 1000;

		const normalizedEmail = email.trim().toLowerCase();
		const emailKey = `login:email:${normalizedEmail}`;
		const emailCount = await store.recordFailedAttempt(emailKey, lockoutMs);

		const ipKey = `login:ip:${ip}`;
		const ipCount = await store.recordFailedAttempt(ipKey, lockoutMs);

		if (emailCount >= maxAttempts) {
			await store.setLockout(emailKey, lockoutMs);
		}
		if (ipCount >= maxAttempts) {
			await store.setLockout(ipKey, lockoutMs);
		}
	}

	static async clearFailedAttempts(
		store: ISecurityStore,
		email: string,
		ip: string,
	): Promise<void> {
		const normalizedEmail = email.trim().toLowerCase();

		await Promise.all([
			store.clearFailedAttempts(`login:email:${normalizedEmail}`),
			store.clearFailedAttempts(`login:ip:${ip}`),
			store.deleteLockout(`login:email:${normalizedEmail}`),
			store.deleteLockout(`login:ip:${ip}`),
		]);
	}
}
