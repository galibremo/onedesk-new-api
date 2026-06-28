import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { EnvType } from '../../core/validators/env';
import type { ISecurityStore } from './security-store.interface';

const KEY_PREFIXES = {
	rateLimit: 'ratelimit:',
	bruteForce: 'bruteforce:',
	lockout: 'lockout:',
} as const;

/**
 * Redis-backed security store for distributed deployments.
 *
 * Uses ioredis for atomic operations (INCR, EXPIRE, SETEX) that work
 * correctly across multiple app instances.
 *
 * Requires CACHE_STORE=redis with a valid REDIS_URL.
 */
@Injectable()
export class RedisSecurityStore implements ISecurityStore, OnModuleDestroy {
	private readonly logger = new Logger(RedisSecurityStore.name);
	private readonly client: Redis;

	constructor(configService: ConfigService<EnvType, true>) {
		const redisUrl = configService.get('REDIS_URL', { infer: true });

		this.client = new Redis(redisUrl || 'redis://localhost:6379', {
			lazyConnect: !redisUrl,
			maxRetriesPerRequest: 3,
			retryStrategy: times => {
				if (times > 5) {
					this.logger.error('Redis connection failed after 5 retries');
					return null;
				}
				return Math.min(times * 200, 2000);
			},
		});

		this.client.on('error', err => {
			this.logger.error('Redis client error', err.stack);
		});

		this.client.on('connect', () => {
			this.logger.log('Redis connection established');
		});
	}

	async increment(key: string, ttlMs: number): Promise<number> {
		const prefixedKey = `${KEY_PREFIXES.rateLimit}${key}`;
		const ttlSeconds = Math.ceil(ttlMs / 1000);

		const result = await this.client.eval(
			`
			local current = redis.call('INCR', KEYS[1])
			if current == 1 then
				redis.call('EXPIRE', KEYS[1], ARGV[1])
			end
			return current
			`,
			1,
			prefixedKey,
			String(ttlSeconds),
		);

		return Number(result);
	}

	async get(key: string): Promise<string | null> {
		const prefixedKey = `${KEY_PREFIXES.rateLimit}${key}`;
		return this.client.get(prefixedKey);
	}

	async set(key: string, value: string, ttlMs?: number): Promise<void> {
		const prefixedKey = `${KEY_PREFIXES.rateLimit}${key}`;
		if (ttlMs) {
			const ttlSeconds = Math.ceil(ttlMs / 1000);
			await this.client.set(prefixedKey, value, 'EX', ttlSeconds);
		} else {
			await this.client.set(prefixedKey, value);
		}
	}

	async delete(key: string): Promise<void> {
		const prefixedKey = `${KEY_PREFIXES.rateLimit}${key}`;
		await this.client.del(prefixedKey);
	}

	async has(key: string): Promise<boolean> {
		const prefixedKey = `${KEY_PREFIXES.rateLimit}${key}`;
		const exists = await this.client.exists(prefixedKey);
		return exists === 1;
	}

	async recordFailedAttempt(key: string, ttlMs: number): Promise<number> {
		const prefixedKey = `${KEY_PREFIXES.bruteForce}${key}`;
		const ttlSeconds = Math.ceil(ttlMs / 1000);

		const result = await this.client.eval(
			`
			local current = redis.call('INCR', KEYS[1])
			if current == 1 then
				redis.call('EXPIRE', KEYS[1], ARGV[1])
			end
			return current
			`,
			1,
			prefixedKey,
			String(ttlSeconds),
		);

		return Number(result);
	}

	async getFailedAttempts(key: string): Promise<number> {
		const prefixedKey = `${KEY_PREFIXES.bruteForce}${key}`;
		const value = await this.client.get(prefixedKey);
		return value ? Number(value) : 0;
	}

	async clearFailedAttempts(key: string): Promise<void> {
		const prefixedKey = `${KEY_PREFIXES.bruteForce}${key}`;
		await this.client.del(prefixedKey);
	}

	async isLockedOut(key: string): Promise<boolean> {
		const prefixedKey = `${KEY_PREFIXES.lockout}${key}`;
		const exists = await this.client.exists(prefixedKey);
		return exists === 1;
	}

	async setLockout(key: string, ttlMs: number): Promise<void> {
		const prefixedKey = `${KEY_PREFIXES.lockout}${key}`;
		const ttlSeconds = Math.ceil(ttlMs / 1000);
		await this.client.set(prefixedKey, 'locked', 'EX', ttlSeconds);
	}

	async deleteLockout(key: string): Promise<void> {
		const prefixedKey = `${KEY_PREFIXES.lockout}${key}`;
		await this.client.del(prefixedKey);
	}

	async cleanup(): Promise<void> {
		// Redis handles expiry automatically via TTL; no manual cleanup needed.
	}

	async onModuleDestroy(): Promise<void> {
		await this.client.quit().catch(err => {
			this.logger.warn('Error disconnecting from Redis', err);
		});
	}

	async shutdown(): Promise<void> {
		await this.onModuleDestroy();
	}
}
