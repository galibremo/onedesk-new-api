/**
 * Abstract interface for the configurable security store.
 *
 * All store implementations (memory, postgres, redis) must satisfy this interface.
 * The store is used for rate limiting, brute-force tracking, and other security-related state.
 */
export interface ISecurityStore {
	/**
	 * Atomically increment a counter key. Sets expiry on first creation.
	 * Returns the new count after increment.
	 */
	increment(key: string, ttlMs: number): Promise<number>;

	/** Get a value by key. Returns null if key does not exist or is expired. */
	get(key: string): Promise<string | null>;

	/** Set a value with optional TTL in milliseconds. */
	set(key: string, value: string, ttlMs?: number): Promise<void>;

	/** Delete a key. */
	delete(key: string): Promise<void>;

	/** Check if a key exists and is not expired. */
	has(key: string): Promise<boolean>;

	/**
	 * Record a failed login attempt. Returns the new attempt count.
	 * This is a semantic alias for increment with brute-force semantics.
	 */
	recordFailedAttempt(key: string, ttlMs: number): Promise<number>;

	/** Get the number of failed attempts for a key. */
	getFailedAttempts(key: string): Promise<number>;

	/** Clear failed attempt tracking for a key. */
	clearFailedAttempts(key: string): Promise<void>;

	/** Check if a key is currently locked out (exists and not expired). */
	isLockedOut(key: string): Promise<boolean>;

	/** Set a lockout for a key with the given TTL. */
	setLockout(key: string, ttlMs: number): Promise<void>;

	/** Delete a lockout key. */
	deleteLockout(key: string): Promise<void>;

	/** Clean up expired entries. Implementation-specific. */
	cleanup(): Promise<void>;

	/** Shut down the store and release resources. */
	shutdown(): Promise<void>;
}
