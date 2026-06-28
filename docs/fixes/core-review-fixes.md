# Core Module Review — Required Fixes

**Review Date:** 2026-05-30  
**Scope:** `api/src/core/` (26 files across 11 subdirectories)

---

## Critical Issues (Must Fix)

### 1. Brute-force lockout is completely broken — key mismatch

**Files:** `guards/brute-force.guard.ts:57-58` vs `97-100`, all `security-store/*.service.ts`

**Problem:**  
`canActivate` checks lockout with key `login:ip:${ip}`, but `recordFailedAttempt` sets the lockout with key `lockout:login:ip:${ip}`. These are different keys, so lockouts are never detected.

| Store | Key checked | Key stored | Match? |
|---|---|---|---|
| Memory | `login:ip:...` | `lockout:login:ip:...` | ❌ |
| Postgres | `login:ip:...` | `lockout:login:ip:...` | ❌ |
| Redis | `lockout:login:ip:...` | `lockout:lockout:login:ip:...` | ❌ |

**Fix:**  
Use the same key in both places. Either remove the `lockout:` prefix from `recordFailedAttempt`'s `setLockout` calls, or add it to the `canActivate` check. Also ensure the Redis store's automatic `lockout:` prefix isn't double-applied.

---

### 2. Email-based lockout is set but never checked

**File:** `guards/brute-force.guard.ts:45-68`

**Problem:**  
`recordFailedAttempt` sets an email-based lockout (`lockout:login:email:...`), but `canActivate` only checks IP-based lockout. An attacker can use different IPs and never be blocked by email lockout.

**Fix:**  
Add an email lockout check in `canActivate`. Extract the email from the request body and check `isLockedOut` for the email key as well.

---

### 3. IP spoofing bypasses rate limiting and brute-force protection

**Files:** `guards/configurable-throttler.guard.ts:125-141`, `guards/brute-force.guard.ts:126-140`

**Problem:**  
Both guards trust `x-forwarded-for` and `x-real-ip` headers unconditionally. If the app is not behind a trusted reverse proxy that overwrites these headers, an attacker can set `X-Forwarded-For: 1.2.3.4` to impersonate any IP and bypass all rate limiting and brute-force protection.

**Fix:**  
Only trust proxy headers when behind a known proxy. Use Express's `trust proxy` setting and `req.ip` (which respects `trust proxy`), or validate the proxy chain. At minimum, add a configuration flag like `TRUST_PROXY=true`.

---

### 4. Throttler "most restrictive" logic selects the LEAST restrictive limit

**File:** `guards/configurable-throttler.guard.ts:101-110`

**Problem:**  
The comment says "Use the most restrictive limit (highest requests-per-second ratio)" but the highest ratio is the least restrictive (more requests per unit time). The code picks the most permissive limit:

```typescript
return currentRatio > bestRatio ? current : best; // picks LEAST restrictive
```

**Fix:**  
Either change to `<` to pick the most restrictive, or enforce all throttle limits independently (which is how `@nestjs/throttler` works with named throttlers).

---

### 5. Redis `delete()` uses wrong key prefix for lockout cleanup

**File:** `security-store/redis-store.service.ts:88-91`, called from `guards/brute-force.guard.ts:118-119`

**Problem:**  
The Redis store's `delete()` method hardcodes the `ratelimit:` prefix. When `clearFailedAttempts` calls `store.delete('lockout:login:ip:...')`, Redis looks for `ratelimit:lockout:login:ip:...`, but the actual lockout key is stored under `lockout:lockout:login:ip:...`. Lockout keys are never cleared in Redis.

**Fix:**  
Either make `delete()` prefix-agnostic, add a `deleteLockout()` method, or have `delete()` accept a namespace parameter.

---

## Warnings (Should Fix)

### 6. Memory store `increment()` resets TTL on every call (sliding window vs. fixed window inconsistency)

**File:** `security-store/memory-store.service.ts:34`

**Problem:**  
Every `increment()` call resets `expiresAt` to `now + ttlMs`, creating a sliding window. The Redis store only sets `EXPIRE` on the first creation, creating a fixed window. The Postgres store also resets `expiresAt` on every upsert (sliding window). This means rate-limiting behavior differs depending on which store is configured.

**Fix:**  
Choose one strategy and implement it consistently across all three stores.

---

### 7. `clearFailedAttempts` in Redis store uses `delete()` which has the `ratelimit:` prefix

**File:** `security-store/redis-store.service.ts:88-91`

**Problem:**  
`clearFailedAttempts` in the brute-force guard calls `store.delete()` for brute-force keys, but the Redis `delete()` method prepends `ratelimit:`. The brute-force keys were stored with the `bruteforce:` prefix (via `recordFailedAttempt`). So `delete()` looks in the wrong namespace and never clears failed attempts in Redis.

**Fix:**  
Add a `clearFailedAttempts` implementation in the Redis store that uses the `bruteforce:` prefix, or make `delete()` prefix-aware.

---

### 8. `RedisSecurityStore` created with `new` inside factory — lifecycle hooks may not fire

**File:** `security-store/security-store.module.ts:54`

**Problem:**  
`new RedisSecurityStore(configService)` bypasses NestJS's IoC container. While NestJS may detect `OnModuleDestroy` on the returned instance, this is not guaranteed across all NestJS versions. If `onModuleDestroy` is not called, the Redis connection leaks on shutdown.

**Fix:**  
Register `RedisSecurityStore` as a conditional provider, or explicitly handle cleanup in a separate `OnModuleDestroy` provider.

---

### 9. `shutdown()` in Redis store resolves before connection is actually closed

**File:** `security-store/redis-store.service.ts:152-155`

**Problem:**  
`onModuleDestroy()` fires `this.client.quit()` with `void` (fire-and-forget), then `shutdown()` immediately returns `Promise.resolve()`. Callers awaiting `shutdown()` will proceed before Redis is disconnected.

**Fix:**

```typescript
async onModuleDestroy(): Promise<void> {
    await this.client.quit();
}
```

---

### 10. `x-request-id` header trusted without validation

**Files:** `middlewares/request-id.middleware.ts:6`, `logging/app.logger.ts:42-46`

**Problem:**  
The `x-request-id` header is used directly without length or character validation. An attacker could send an extremely long string (log injection / DoS) or inject newline characters (log forging).

**Fix:**  
Validate the header: limit length (e.g., 64 chars), restrict to safe characters (UUID format or alphanumeric + hyphens).

---

### 11. `PORT` env var not transformed to number

**File:** `validators/env.ts:18`

**Problem:**  
`PORT` is validated as a numeric string but never `.transform()`ed to a number, unlike all other numeric env vars (`HEALTH_HEAP_LIMIT_MB`, `RATE_LIMIT_TTL_SECONDS`, etc.). Consumers must manually call `Number()` on it.

**Fix:**  
Add `.transform(value => Number(value))` after the `.refine()` call, consistent with other numeric env vars.

---

### 12. `baseQuerySchema` date comparison is lexicographic, not temporal

**File:** `validators/base-query.schema.ts:29`

**Problem:**

```typescript
.refine(data => !data.fromDate || !data.toDate || data.fromDate <= data.toDate, ...)
```

`fromDate` and `toDate` are validated as plain strings (`validateString`). String comparison only works correctly for ISO 8601 dates. Formats like `MM/DD/YYYY` will compare incorrectly.

**Fix:**  
Either use `validateDate` (which transforms to `Date` objects) or add a format constraint (e.g., ISO 8601 regex).

---

### 13. Postgres store fires cleanup DELETE on every write operation

**File:** `security-store/postgres-store.service.ts:62,96`

**Problem:**  
`void this.cleanupExpired()` runs on every `increment()` and `set()` call. Under high request volume, this generates a DELETE query per request, adding unnecessary database load.

**Fix:**  
Remove the lazy cleanup from write operations. Rely solely on the 5-minute interval timer (line 30–34), or throttle the cleanup to run at most once per N seconds.

---

### 14. `HttpExceptionFilter` catches all exceptions but name implies HTTP-only

**File:** `filters/http-exception.filter.ts:14`

**Problem:**  
`@Catch()` with no arguments catches all exceptions (including non-HTTP ones like database errors, network errors, etc.). The class name `HttpExceptionFilter` is misleading.

**Fix:**  
Rename to `GlobalExceptionFilter` or `AllExceptionsFilter` to accurately reflect its behavior.

---

### 15. `validatePhoneNumber` silently accepts empty strings

**File:** `validators/common.schema.ts:287-312`

**Problem:**  
`baseString(name)` without `min: 1` allows empty strings. The `superRefine` has `if (!val) return;` which passes empty strings. A required phone number field would accept `""` as valid.

**Fix:**  
Either add `{ min: 1 }` to `baseString` or remove the early return in `superRefine`. If the phone is meant to be optional, wrap with `.optional()` at the call site and remove the empty-string bypass.

---

### 16. CSP parser silently drops value-less directives

**File:** `middlewares/security-headers.middleware.ts:91`

**Problem:**

```typescript
if (directive && values.length > 0) { ... }
```

Directives like `upgrade-insecure-requests` (which have no values) are silently dropped from custom CSP strings. This could weaken security if a user expects this directive to be applied.

**Fix:**  
Handle value-less directives by assigning an empty array: `directives[camelDirective] = values;` (remove the `values.length > 0` check).

---

### 17. Two competing throttler guards create confusion

**Files:** `guards/throttler.guard.ts` and `guards/configurable-throttler.guard.ts`

**Problem:**  
`CustomThrottlerGuard` extends `@nestjs/throttler`'s `ThrottlerGuard`, while `ConfigurableThrottlerGuard` is a custom implementation using the security store. Having both in the codebase without clear documentation on which to use can lead to misconfiguration (e.g., applying both, or using the wrong one).

**Fix:**  
Remove the unused guard or add clear documentation/JSDoc explaining when to use each.

---

### 18. `cleanupInterval` not `unref()`'d — prevents graceful process exit

**Files:** `security-store/memory-store.service.ts:23`, `security-store/postgres-store.service.ts:30`

**Problem:**  
`setInterval` without `.unref()` keeps the Node.js event loop alive, preventing natural process exit. This causes issues in test environments and graceful shutdowns.

**Fix:**

```typescript
this.cleanupInterval = setInterval(() => { ... }, 60_000);
this.cleanupInterval.unref();
```

---

## Suggestions (Nice to Have)

### 19. Variable shadowing in `ApiResponseInterceptor`

**File:** `interceptors/api-response.interceptor.ts:74`

**Problem:**  
The inner `const response = data as Partial<ApiResponse<T>>` shadows the outer `const response = ctx.getResponse<Response>()` from line 62.

**Fix:**  
Rename the inner variable to `apiResponse` or `existingResponse`.

---

### 20. `validatePositiveNumber` name is misleading

**File:** `validators/common.schema.ts:199-200`

**Problem:**  
`validatePositiveNumber` enforces `int: true`, but the name suggests any positive number. A consumer expecting to validate `3.14` would be surprised.

**Fix:**  
Rename to `validatePositiveInteger` or remove the `int: true` constraint.

---

### 21. `validateUsernameOrEmail` uses a different email regex than `baseEmail`

**File:** `validators/common.schema.ts:314-322` vs line 106

**Problem:**  
The email regex in `validateUsernameOrEmail` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) differs from Zod's built-in email validation used in `baseEmail`. An input could pass one but fail the other.

**Fix:**  
Use the same email validation logic in both places.

---

### 22. `envSchema` spread merge could silently overwrite duplicate keys

**File:** `validators/env.ts:88-101`

**Problem:**  
Using `...schema.shape` to merge multiple schemas means if two schemas accidentally define the same key, the later one silently wins.

**Fix:**  
Use `z.object({}).merge()` chains or add a runtime check for duplicate keys.

---

### 23. `validateEnv` error details only logged to console, not in thrown Error

**File:** `validators/env.ts:150-154`

**Problem:**  
The specific validation failures are logged via `console.error` but the thrown `Error` only says "Environment validation failed". In containerized environments, the stderr and exception may be captured differently.

**Fix:**  
Include the details in the error message: `throw new Error('Environment validation failed:\n' + errorMessages)`.

---

### 24. `route.logger.ts` writes `routes.json` to `process.cwd()` by default

**File:** `logging/route.logger.ts:101`

**Problem:**  
Writing to `process.cwd()` could fail or write to unexpected locations depending on how the app is launched. Also, `writeFileSync` blocks the event loop.

**Fix:**  
Use `writeFile` (async) and consider writing to a configured output directory.

---

### 25. `OTPGenerator` return type limits OTP length

**File:** `helpers/app.helper.ts:31-39`

**Problem:**  
Returns a `number`, which for OTPs longer than 10 digits would exceed `Number.MAX_SAFE_INTEGER`. Consider returning a string for safety.

**Fix:**  
Return `String(randomInt(min, max + 1))` or use string-based OTP generation.

---

### 26. `app.helper.ts` cookie config uses unsafe type cast

**File:** `helpers/app.helper.ts:57`

**Problem:**

```typescript
configService.get<CookieOptions['sameSite']>('COOKIE_SAME_SITE', 'lax')
```

The env schema types `COOKIE_SAME_SITE` as `'strict' | 'lax' | 'none'` (strings), but `CookieOptions['sameSite']` also accepts `boolean`. The generic type parameter is imprecise.

**Fix:**  
Use the exact string union type from the env schema instead of `CookieOptions['sameSite']`.

---

### 27. `RolesGuard` doesn't handle WebSocket or GraphQL contexts

**File:** `guards/roles.guard.ts:22`

**Problem:**  
`context.switchToHttp()` will throw if the guard is used in a WebSocket or GraphQL context. Consider adding a context-type check if the app uses multiple transport layers.

**Fix:**  
Add a context-type check before calling `switchToHttp()`.

---

### 28. Local `or()` helper in postgres store shadows potential drizzle-orm import

**File:** `security-store/postgres-store.service.ts:159-161`

**Problem:**  
The local `function or(...)` could conflict if `or` is later imported from `drizzle-orm`. Consider renaming to `orCondition` or importing `or` from drizzle-orm directly.

**Fix:**  
Rename to `orCondition` or use drizzle-orm's `or` function.

---

## Positive Observations

- **Security-store abstraction** — Clean `ISecurityStore` interface with three interchangeable implementations (Strategy pattern)
- **Environment validation** — Comprehensive Zod-based validation with cross-field `superRefine` checks
- **Sensitive data redaction** — `HttpExceptionFilter.redactSensitiveData()` and Pino's `redact` config for headers
- **DomainError** — Typed factory functions provide a clean, consistent error API
- **Atomic Redis rate limiting** — Lua script uses `INCR` + `EXPIRE` atomically, avoiding race conditions
- **Fail-open rate limiting** — Graceful degradation when store errors (conscious trade-off)
- **Security headers** — Well-configured Helmet defaults with environment-aware CSP
- **Request ID propagation** — Clean middleware with proper Pino logger integration
- **Brute-force guard design** — Static methods provide clean API for controllers (once key mismatch is fixed)
- **Zod validation toolkit** — Rich, reusable validators with consistent error messages
