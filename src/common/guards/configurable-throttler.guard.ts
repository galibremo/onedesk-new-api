import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { EnvType } from '../../core/validators/env';
import { SECURITY_STORE_TOKEN, type ISecurityStore } from '../../core/security-store';
import { extractIp } from '../helpers/ip.helper';

const SKIP_THROTTLE_KEY = 'skipThrottle';

const THROTTLE_KEY = 'throttle';

interface ThrottleLimit {
	limit: number;
	ttl: number;
}

@Injectable()
export class ConfigurableThrottlerGuard implements CanActivate {
	private readonly logger = new Logger(ConfigurableThrottlerGuard.name);

	constructor(
		@Inject(SECURITY_STORE_TOKEN)
		private readonly store: ISecurityStore,
		private readonly configService: ConfigService<EnvType, true>,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const handler = context.getHandler();
		const controller = context.getClass();

		const skipThrottle = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
			handler,
			controller,
		]);
		if (skipThrottle) {
			return true;
		}

		const throttleLimits = this.reflector.getAllAndOverride<Record<string, ThrottleLimit>>(
			THROTTLE_KEY,
			[handler, controller],
		);

		const { limit, ttl } = this.resolveLimits(throttleLimits);

		const trustProxy = this.configService.get('TRUST_PROXY', { infer: true }) === 'true';
		const ip = extractIp(request, trustProxy);
		if (!ip) {
			this.logger.warn('Could not extract client IP, allowing request');
			return true;
		}

		const key = `${ip}:${request.path}`;

		try {
			const count = await this.store.increment(key, ttl);

			if (count > limit) {
				this.logger.warn(`Rate limit exceeded for IP ${ip} on ${request.path}: ${count}/${limit}`);
				return false;
			}

			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`Security store error during rate limiting: ${message}`);
			return true;
		}
	}

	private resolveLimits(limits?: Record<string, ThrottleLimit>): { limit: number; ttl: number } {
		if (limits && Object.keys(limits).length > 0) {
			const entries = Object.values(limits);
			return entries.reduce((best, current) => {
				const bestRatio = best.limit / best.ttl;
				const currentRatio = current.limit / current.ttl;
				return currentRatio < bestRatio ? current : best;
			});
		}

		const ttlSeconds = this.configService.get('RATE_LIMIT_TTL_SECONDS', { infer: true });
		const maxRequests = this.configService.get('RATE_LIMIT_MAX_REQUESTS', { infer: true });

		return {
			limit: maxRequests,
			ttl: ttlSeconds * 1000,
		};
	}
}
