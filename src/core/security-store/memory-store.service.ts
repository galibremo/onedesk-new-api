import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ISecurityStore } from './security-store.interface';

interface StoreEntry {
	value: string;
	expiresAt: number | null; // Unix timestamp in ms, null = no expiry
}

/**
 * In-memory security store for single-instance deployments.
 *
 * Uses a Map with periodic cleanup of expired entries.
 * Suitable for local development or single-instance production deployments.
 * Not suitable for multi-instance deployments behind a load balancer.
 */
@Injectable()
export class MemorySecurityStore implements ISecurityStore, OnModuleDestroy {
	private readonly store = new Map<string, StoreEntry>();
	private readonly cleanupInterval: ReturnType<typeof setInterval>;

	constructor() {
		this.cleanupInterval = setInterval(() => {
			this.cleanupSync();
		}, 60_000);
		this.cleanupInterval.unref();
	}

	increment(key: string, ttlMs: number): Promise<number> {
		const now = Date.now();
		const existing = this.store.get(key);

		if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
			const newValue = Number(existing.value) + 1;
			this.store.set(key, { value: String(newValue), expiresAt: existing.expiresAt });
			return Promise.resolve(newValue);
		}

		this.store.set(key, { value: '1', expiresAt: now + ttlMs });
		return Promise.resolve(1);
	}

	get(key: string): Promise<string | null> {
		const entry = this.store.get(key);
		if (!entry) return Promise.resolve(null);
		if (entry.expiresAt && entry.expiresAt <= Date.now()) {
			this.store.delete(key);
			return Promise.resolve(null);
		}
		return Promise.resolve(entry.value);
	}

	set(key: string, value: string, ttlMs?: number): Promise<void> {
		const expiresAt = ttlMs ? Date.now() + ttlMs : null;
		this.store.set(key, { value, expiresAt });
		return Promise.resolve();
	}

	delete(key: string): Promise<void> {
		this.store.delete(key);
		return Promise.resolve();
	}

	has(key: string): Promise<boolean> {
		const entry = this.store.get(key);
		if (!entry) return Promise.resolve(false);
		if (entry.expiresAt && entry.expiresAt <= Date.now()) {
			this.store.delete(key);
			return Promise.resolve(false);
		}
		return Promise.resolve(true);
	}

	recordFailedAttempt(key: string, ttlMs: number): Promise<number> {
		return this.increment(key, ttlMs);
	}

	async getFailedAttempts(key: string): Promise<number> {
		const value = await this.get(key);
		return value ? Number(value) : 0;
	}

	async clearFailedAttempts(key: string): Promise<void> {
		await this.delete(key);
	}

	async isLockedOut(key: string): Promise<boolean> {
		return this.has(key);
	}

	async setLockout(key: string, ttlMs: number): Promise<void> {
		await this.set(key, 'locked', ttlMs);
	}

	async deleteLockout(key: string): Promise<void> {
		await this.delete(key);
	}

	cleanup(): Promise<void> {
		this.cleanupSync();
		return Promise.resolve();
	}

	private cleanupSync(): void {
		const now = Date.now();
		for (const [key, entry] of this.store.entries()) {
			if (entry.expiresAt && entry.expiresAt <= now) {
				this.store.delete(key);
			}
		}
	}

	onModuleDestroy(): void {
		clearInterval(this.cleanupInterval);
		this.store.clear();
	}

	shutdown(): Promise<void> {
		this.onModuleDestroy();
		return Promise.resolve();
	}
}
