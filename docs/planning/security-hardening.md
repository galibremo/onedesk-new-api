# Security Hardening

This document explains the security hardening features implemented in the boilerplate API,
including how to choose between memory, PostgreSQL, and Redis for the security store.

---

## Overview

The security hardening layer provides:

1. **Security Headers** (Helmet) — HTTP security headers on every response
2. **Content Security Policy** — Environment-aware CSP configuration
3. **Configurable Rate Limiting** — IP-based rate limiting with pluggable storage
4. **Brute-Force Login Protection** — Lockout after failed login attempts
5. **Password Strength Policy** — Configurable minimum length enforcement
6. **API Key Management** — Environment-variable-based secrets with startup validation

---

## Security Store: Choosing Your Backend

All security-related state (rate limits, brute-force tracking, lockouts) is stored through
a unified `ISecurityStore` interface. The backend is controlled by the `CACHE_STORE`
environment variable.

### `CACHE_STORE=memory` (Default)

**Best for:** Local development, single-instance deployments, low-traffic apps.

- **Pros:** Zero configuration, no external dependencies, fastest
- **Cons:** State is lost on restart, rate limits are per-instance (not shared across instances)
- **When to use:** Development, staging, or any single-instance deployment

```bash
CACHE_STORE="memory"
```

### `CACHE_STORE=postgres`

**Best for:** Multi-instance deployments where you already have PostgreSQL and don't want
to add Redis.

- **Pros:** Shared state across all instances, no extra infrastructure, persistent
- **Cons:** Slightly higher latency than Redis, requires a `security_cache` table
- **When to use:** Production deployments with multiple API instances behind a load balancer

```bash
CACHE_STORE="postgres"
```

The `security_cache` table is created automatically via Drizzle migrations:

```bash
pnpm db:generate   # Generate migration
pnpm db:migrate    # Apply migration (or pnpm db:push for development)
```

### `CACHE_STORE=redis`

**Best for:** High-traffic, distributed deployments where Redis is already available.

- **Pros:** Fastest distributed store, atomic operations, automatic TTL expiry
- **Cons:** Requires Redis infrastructure, requires `ioredis` package
- **When to use:** Production deployments with Redis already in the infrastructure

```bash
CACHE_STORE="redis"
REDIS_URL="redis://localhost:6379"
```

Install the optional Redis client:

```bash
pnpm add ioredis
```

### Comparison Table

| Feature | Memory | PostgreSQL | Redis |
|---|---|---|---|
| Multi-instance support | No | Yes | Yes |
| Persistent across restarts | No | Yes | No (unless configured) |
| Extra infrastructure needed | No | No (uses existing DB) | Yes (Redis server) |
| Extra npm dependency | No | No | Yes (`ioredis`) |
| Atomic operations | Yes (single-threaded) | Yes (SQL upsert) | Yes (Lua scripts) |
| Latency | ~0ms | ~1-5ms | ~0.1-1ms |
| Cleanup of expired entries | Periodic (60s) | Lazy + periodic (5min) | Automatic (TTL) |

---

## Environment Variables

### Security Store

| Variable | Default | Description |
|---|---|---|
| `CACHE_STORE` | `memory` | Storage backend: `memory`, `postgres`, or `redis` |
| `REDIS_URL` | _(empty)_ | Redis connection URL (required when `CACHE_STORE=redis`) |

### Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_TTL_SECONDS` | `60` | Time window in seconds for IP-based rate limiting |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Maximum requests per IP within the time window |

### Brute-Force Protection

| Variable | Default | Description |
|---|---|---|
| `LOGIN_MAX_FAILED_ATTEMPTS` | `5` | Maximum failed login attempts before lockout |
| `LOGIN_LOCKOUT_MINUTES` | `15` | Lockout duration in minutes after exceeding max attempts |

### Password Policy

| Variable | Default | Description |
|---|---|---|
| `PASSWORD_MIN_LENGTH` | `8` | Minimum password length (Zod schema also enforces uppercase, lowercase, number, special char) |

### Security Headers

| Variable | Default | Description |
|---|---|---|
| `HELMET_ENABLED` | `true` | Enable/disable Helmet security headers middleware |
| `CSP_POLICY` | _(empty)_ | Custom Content Security Policy string (overrides environment-aware defaults) |

---

## Security Headers (Helmet)

Helmet is applied globally and sets the following headers:

| Header | Production | Development |
|---|---|---|
| `Content-Security-Policy` | Strict (self-only + Cloudinary) | Disabled (allows HMR/dev tools) |
| `Strict-Transport-Security` | 1 year, includeSubDomains, preload | Disabled |
| `X-Content-Type-Options` | `nosniff` | `nosniff` |
| `X-Frame-Options` | `DENY` | `DENY` |
| `X-XSS-Protection` | `0` (modern browsers) | `0` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` | `require-corp` |

### Custom CSP

To override the default CSP, set `CSP_POLICY` in your environment:

```bash
CSP_POLICY="default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline'"
```

The CSP string uses standard CSP directive syntax (semicolon-separated).

---

## Brute-Force Login Protection

### How It Works

1. **Before login:** The `BruteForceGuard` checks if the client IP is locked out.
   If locked out, returns `429 Too Many Requests` immediately.

2. **On failed login:** Failed attempts are tracked by both email and IP address.
   When either exceeds `LOGIN_MAX_FAILED_ATTEMPTS`, a lockout is set for
   `LOGIN_LOCKOUT_MINUTES`.

3. **On successful login:** All failed attempt tracking is cleared for that email and IP.

### Safe Error Messages

Error messages are designed to not reveal whether an account exists:

- `"Invalid credentials"` — generic message for wrong password or non-existent email
- `"Too many failed login attempts. Please try again in 15 minutes."` — lockout message

### Protected Endpoints

- `POST /auth/login` — Password login
- `POST /auth/google` — Google OAuth login

---

## Rate Limiting

### How It Works

The `ConfigurableThrottlerGuard` applies IP-based rate limiting to all routes by default.
Per-route limits can be set using the `@Throttle()` decorator from `@nestjs/throttler`.

### Default Limits

- **Global:** `RATE_LIMIT_MAX_REQUESTS` requests per `RATE_LIMIT_TTL_SECONDS` seconds per IP
- **Per-route:** Use `@Throttle({ short: { limit, ttl }, long: { limit, ttl } })`

### Decorator Support

The guard respects `@nestjs/throttler` decorators:

```typescript
@Throttle({ short: { limit: 3, ttl: 60000 } })
@Post('sensitive-endpoint')
async sensitiveHandler() { ... }

@SkipThrottle()
@Get('public-endpoint')
async publicHandler() { ... }
```

---

## Password Strength Policy

Passwords are validated at two levels:

1. **Zod Schema (compile-time):** Enforces minimum 8 characters, uppercase, lowercase,
   number, and special character. Applied at the API boundary.

2. **Runtime Check (auth service):** Enforces `PASSWORD_MIN_LENGTH` from environment.
   Applied during `setPassword` and `changePassword` operations.

### Rules

- Minimum length: configurable via `PASSWORD_MIN_LENGTH` (default: 8)
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&* etc.)

---

## API Key Management

All third-party API keys are managed through environment variables or the database:

- **Never hardcoded** — all secrets come from `.env` or the hosting platform's secret manager
- **Validated at startup** — missing required keys cause the application to fail fast with
  clear error messages
- **Conditional validation** — integration keys (Google, Cloudinary) are only required
  when their respective feature flags are enabled
- **Database-managed** — email provider credentials (Brevo, Resend, Nodemailer, AWS SES) are stored encrypted in the database and configured via the SMTP Providers API

### Required Secrets (Always)

- `AUTH_SECRET` — JWT signing key
- `CSRF_SECRET` — CSRF token signing key
- `CRYPTO_SECRET` — AES encryption key (32 characters)

### Optional Secrets (Feature-Gated)

- `GOOGLE_CLIENT_ID` — required when `GOOGLE_LOGIN_ENABLED=true`
- `CLOUDINARY_*` — required when `CLOUDINARY_ENABLED=true`

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Request                        │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Security Headers Middleware (Helmet)            │
│  - CSP, HSTS, X-Frame-Options, etc.             │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Configurable Throttler Guard                    │
│  - IP-based rate limiting                       │
│  - Uses ISecurityStore (memory/pg/redis)        │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Brute-Force Guard (login endpoints only)        │
│  - Checks IP lockout status                     │
│  - Returns 429 if locked out                    │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Controller → Service                            │
│  - Password validation (Zod + runtime check)    │
│  - Brute-force tracking on failure              │
│  - Brute-force clearing on success              │
└─────────────────────────────────────────────────┘
```

---

## Migration Notes

When switching from `memory` to `postgres` or `redis`:

1. **Memory → PostgreSQL:**
   - Run `pnpm db:generate` and `pnpm db:migrate` to create the `security_cache` table
   - Set `CACHE_STORE=postgres`
   - Existing rate limit/lockout state will be lost (new store starts empty)

2. **Memory → Redis:**
   - Install `ioredis`: `pnpm add ioredis`
   - Set `CACHE_STORE=redis` and `REDIS_URL=redis://...`
   - Existing rate limit/lockout state will be lost (new store starts empty)

3. **PostgreSQL ↔ Redis:**
   - State is not migrated between stores
   - Switch the env var and restart
