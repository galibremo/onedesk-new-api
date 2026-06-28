# API Boilerplate — Gap Analysis & Feedback Report

> **Stack**: NestJS 11, Drizzle ORM, PostgreSQL, Zod, JWT (cookie-based), Cloudinary, SMTP multi-provider email (Brevo, Resend, Nodemailer, AWS SES),
> Google OAuth

---

## ✅ What's Already Well Done

Before the gaps, here's what is solid in this boilerplate:

| Area                   | Implementation                                                 |
| ---------------------- | -------------------------------------------------------------- |
| **Authentication**     | Magic-link + Google OAuth + TOTP 2FA + recovery codes          |
| **Session management** | Full device-aware sessions with revoke, revoke-others, list    |
| **CSRF protection**    | `csrf-csrf` with a dedicated guard and module                  |
| **Error handling**     | Global `HttpExceptionFilter` with sensitive-field redaction    |
| **Response format**    | Consistent `ApiResponse<T>` wrapper via interceptor            |
| **Validation**         | Zod-based pipes with rich, named error messages                |
| **DB schema**          | Proper indexes, UUID public IDs, `serial` internal IDs         |
| **Role-based access**  | `RolesGuard` + `@Roles()` decorator                            |
| **Media uploads**      | Cloudinary integration with face-detection crop                |
| **System settings**    | Access model (OPEN/CLOSED/APPROVAL_BASED), allowed roles       |
| **Env validation**     | Startup-time Zod env check; fails fast                         |
| **Cookie security**    | `httpOnly`, `secure`, `sameSite`, domain-aware helpers         |
| **Crypto module**      | Dedicated AES encryption service (not plain bcrypt for tokens) |
| **Seeding**            | `db:seed` + `db:clear` scripts exist                           |

---

## 🔴 Critical Missing Features

### 1. Rate Limiting / Throttling

**Severity: Critical**

There is no rate limiting anywhere. Any endpoint — especially auth flows — can be brute-forced.

**What's missing:**

- No `@nestjs/throttler` or equivalent installed/configured
- The `magic-link/request` endpoint has zero request throttling
- The 2FA `verify` endpoint has per-session lockout, but no global IP-based throttle
- No differentiation between per-IP vs per-user vs global limits

**What to add:**

```typescript
// Install: @nestjs/throttler
ThrottlerModule.forRoot([
	{ name: 'short', ttl: 1000, limit: 3 },
	{ name: 'long', ttl: 60000, limit: 20 },
]);
// Apply @Throttle({ short: { limit: 1, ttl: 60000 } }) on sensitive endpoints
```

---

### 2. API Documentation (Swagger / OpenAPI)

**Severity: Critical for a boilerplate**

There is no Swagger/OpenAPI setup. A boilerplate must ship with interactive docs.

**What's missing:**

- No `@nestjs/swagger` installed
- No `@ApiProperty`, `@ApiResponse`, `@ApiTags` decorators
- `routes.json` is auto-generated but contains raw NestJS metadata — not human-readable API docs

**What to add:**

```typescript
// main.ts
const config = new DocumentBuilder()
	.setTitle('Boilerplate API')
	.addCookieAuth('access-token')
	.build();
SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
```

---

### 3. Request ID Propagation

**Severity: High**

The `HttpExceptionFilter` reads `x-request-id` but no middleware injects one if it's absent. Every
request should get a UUID so logs can be correlated.

**What's missing:**

- No middleware to attach `req.requestId` to every incoming request
- `req.requestId` is referenced in the filter but never set by the application
- No `X-Request-Id` header returned in responses for client-side correlation

---

### 4. Global Input Validation Pipe

**Severity: High**

Validation is done manually per-endpoint with `new ZodValidationPipe(schema)`. There is no global
`ValidationPipe`.

**What's missing:**

- No `app.useGlobalPipes(new ZodValidationPipe(...))` — every controller must opt-in manually
- Raw/unparsed request bodies can reach handlers if a developer forgets the pipe
- No `whitelist: true` equivalent to strip unexpected keys by default (Zod `.strict()` is used in
  _some_ schemas but not all)

---

### 5. Health Check Endpoint

**Severity: High**

There is no `/health` or `/health/live` / `/health/ready` endpoint. Essential for container
orchestrators (K8s, ECS, Railway, etc.).

**What's missing:**

- No `@nestjs/terminus` integration
- No database connectivity check
- No disk/memory probe
- `docker-compose.yml` has no `healthcheck` directive

---

## 🟠 Important Missing Features

### 6. Pagination on Media Endpoint

**Severity: Medium**

`GET /media/` returns `MediaResponseType[]` — an unbounded array. If a user has thousands of media
items, this will OOM the server and client.

**What's missing:**

- No pagination query params (`page`, `limit`, `cursor`)
- The `baseQuerySchema` and pagination helpers already exist — they are just not applied to media
- The `ApiResponse` interface already supports `Pagination | CursorPagination` but it's unused here

---

### 7. Audit / Activity Log

**Severity: Medium**

There is no audit trail for sensitive actions (login, role changes, 2FA disable, user deletion).

**What's missing:**

- No `audit_logs` table in the Drizzle models
- No log entries when: admin changes user role, admin creates user, user disables 2FA, sessions are
  revoked
- This is a significant compliance gap for enterprise boilerplates

---

### 8. Email Templates

**Severity: Medium**

The `template` module and `handlebars` dependency exist, but there's only a
`magic-link-email.service.ts`. No other transactional emails are templated.

**What's missing:**

- Welcome email after first-time registration
- Account approval notification email (system uses `APPROVAL_BASED` model but no email is sent on
  approval)
- 2FA enabled/disabled notification email
- Admin-created account invitation email

---

### 9. Refresh Token / Token Rotation

**Severity: Medium**

The boilerplate uses long-lived JWT sessions stored in `sessions` table. There is no short-lived
access token + refresh token pattern.

**What's missing:**

- A single `access-token` cookie with `maxAge = sessionTimeout` (30 days by default based on
  `constant.helpers.ts`)
- No silent refresh mechanism — user is kicked out when session expires with no way to auto-renew
- Token rotation on refresh (prevents session fixation from stolen tokens) is missing

> This is a design choice, but for a production boilerplate it should at least be documented or
> offer both patterns.

---

### 10. Soft Delete for Users

**Severity: Medium**

`DELETE /users/:id` performs a hard delete. There is no soft-delete pattern.

**What's missing:**

- No `deletedAt` column on the `users` table
- No `isDeleted` flag
- All cascades (`onDelete: 'cascade'`) will destroy sessions, accounts, 2FA data — with no recovery
  path

---

### 11. User Search / `GET /users/:id`

**Severity: Medium**

`GET /users` lists users with filters but there's no single-user fetch endpoint by admin
(`GET /users/:id`).

**What's missing:**

- No `GET /users/:id` to fetch a specific user's profile as admin
- Cannot retrieve a user's session list as admin without extra implementation
- `users.policy.ts` exists but it's unclear if it enforces ownership vs admin access properly

---

## 🟡 Developer Experience & Infrastructure Gaps

### 12. Environment File — All Variables Required at Boot

**Severity: Medium**

`validateEnv` requires ALL env vars (including `CLOUDINARY_*`, `GOOGLE_CLIENT_ID`) to be
set even if those features are not needed. This is a painful DX issue.

**What's missing:**

- No optional service env groups (e.g. `CLOUDINARY_ENABLED=false` to skip cloud upload)
- Cloudinary and Google env vars should be **conditionally required** based on feature flags
- Email provider credentials are no longer env-based — they are configured at runtime via the SMTP Providers API
- New developers who just want to run the boilerplate locally face immediate env friction

---

### 13. Docker Setup is Incomplete

**Severity: Medium**

`docker-compose.yml` only runs PostgreSQL. There's no app container.

**What's missing:**

- No `Dockerfile` in the repo
- No `app` service in `docker-compose.yml`
- No `healthcheck` on the postgres service
- Volume mapping `./pgdata:/var/lib/postgresql` is missing the `/data` subdirectory (should be
  `/var/lib/postgresql/data`)
- No Redis service (useful if throttling or caching is added later)

---

### 14. No Caching Layer

**Severity: Low-Medium**

`SystemService.getSettings()` is called on nearly every authenticated request (e.g. in
`assertCanAccessDashboard`) with no caching.

**What's missing:**

- No `@nestjs/cache-manager` or in-memory cache for system settings
- No Redis integration for distributed caching
- `getSettings()` hits the DB on every auth check — potential N+1 performance issue at scale

---

### 15. Logging is Basic

**Severity: Medium**

The `app.logger.ts` uses Morgan-style middleware, and `route.logger.ts` logs routes to a file. But
structured, queryable logging is absent.

**What's missing:**

- No structured JSON logging (e.g. `pino` or `winston` with JSON transport)
- No log levels configurable via environment
- No correlation between `requestId` in logs (the filter logs it but the request middleware doesn't
  inject it)
- `console.error` in `validateEnv` is used directly instead of the NestJS Logger

---

### 16. Missing `.env.example` Completeness

**Severity: Low**

The `.env.example` file exists but based on the `env.ts` validator, it must be missing some keys or
have outdated entries (since the validator is the source of truth).

**What to audit:**

- Cross-reference every key in `envSchema` vs `.env.example`
- Add inline comments explaining each variable's purpose and example values
- Add a `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` section (used in
  `docker-compose.yml` but not in `envSchema`)

---

### 17. No OpenTelemetry / Observability

**Severity: Low (but notable for production boilerplate)**

**What's missing:**

- No tracing (OpenTelemetry, Datadog APM, etc.)
- No metrics endpoint (Prometheus-compatible `/metrics`)
- No performance timing on slow DB queries

---

### 18. `OTPGenerator` Uses `Math.random()` — Not Cryptographically Secure

**Severity: Medium (Security)**

In `app.helpers.ts`, `OTPGenerator` uses `Math.floor(Math.random() * ...)`. `Math.random()` is
**not** cryptographically secure.

**What's missing:**

- Should use `crypto.randomInt(min, max)` (Node.js built-in) instead
- This utility is currently unused in the auth flow (magic links use `randomBytes`) but could be
  accidentally used for OTPs in the future

---

### 19. No GitHub CI Workflow

**Severity: Low**

`.github/` directory exists with `agents/` and `instructions/` subdirectories, but there appear to
be no actual GitHub Actions workflow files (`.yml`).

**What's missing:**

- No CI pipeline for lint + build on PRs
- No automated deployment workflow
- No dependabot configuration

---

### 20. CORS `methods` Missing `HEAD` and `OPTIONS`

**Severity: Low**

```typescript
methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
```

`OPTIONS` is needed for preflight requests (especially with non-simple headers like `x-csrf-token`).
`HEAD` is a standard HTTP method.

---

## 📊 Summary Table

| #   | Issue                            | Severity    | Category        |
| --- | -------------------------------- | ----------- | --------------- |
| 1   | No rate limiting / throttling    | 🔴 Critical | Security        |
| 2   | No Swagger / OpenAPI docs        | 🔴 Critical | DX / API Design |
| 3   | No request ID middleware         | 🔴 High     | Observability   |
| 4   | No global validation pipe        | 🔴 High     | Reliability     |
| 5   | No health check endpoint         | 🔴 High     | Infrastructure  |
| 6   | Media endpoint is unpaginated    | 🟠 Medium   | API Design      |
| 7   | No audit / activity log          | 🟠 Medium   | Compliance      |
| 8   | Missing transactional emails     | 🟠 Medium   | Features        |
| 9   | No refresh token rotation        | 🟠 Medium   | Security        |
| 10  | Hard delete on users             | 🟠 Medium   | Data Safety     |
| 11  | No `GET /users/:id`              | 🟠 Medium   | API Design      |
| 12  | All env vars required at startup | 🟠 Medium   | DX              |
| 13  | Incomplete Docker setup          | 🟠 Medium   | Infrastructure  |
| 14  | No caching for settings          | 🟡 Low-Med  | Performance     |
| 15  | Basic / unstructured logging     | 🟠 Medium   | Observability   |
| 16  | `.env.example` may be incomplete | 🟡 Low      | DX              |
| 17  | No OpenTelemetry / metrics       | 🟡 Low      | Observability   |
| 18  | `Math.random()` in OTPGenerator  | 🟠 Medium   | Security        |
| 19  | No GitHub Actions CI             | 🟡 Low      | DevOps          |
| 20  | CORS missing `OPTIONS`/`HEAD`    | 🟡 Low      | Security        |

---

## 🎯 Recommended Priority Order

**Phase 1 — Fix Before Using in Production:**

1. Add `@nestjs/throttler` rate limiting
2. Add Request ID middleware + response header
3. Add `/health` endpoint via `@nestjs/terminus`
4. Fix `Math.random()` → `crypto.randomInt()`
5. Fix Docker volume path + add `healthcheck`

**Phase 2 — Boilerplate Completeness:** 6. Add Swagger/OpenAPI setup 7. Paginate the media listing
endpoint 8. Make Cloudinary/Google env vars conditional (email providers are now database-driven) 9. Add structured logging
(pino/winston) 10. Add GitHub Actions CI workflow

**Phase 3 — Enterprise Hardening:** 11. Add audit log table + service 12. Add soft delete for
users 13. Add `GET /users/:id` admin endpoint 14. Add welcome/approval email templates 15. Add
Redis + caching for system settings
