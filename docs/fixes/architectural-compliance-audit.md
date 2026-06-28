# Architectural Compliance Audit

**Audit Date:** May 31, 2026
**Auditor:** Automated Codebase Review
**Scope:** Full project — `src/`, `drizzle.config.ts`, `docs/`
**Reference:** `.opencode/agents/project.md`

---

## Executive Summary

This audit evaluates the project against the eleven non-negotiable architectural rules defined in the project agent configuration. The codebase demonstrates strong foundations in error handling architecture, Zod-based input validation, and API documentation coverage. However, significant structural deviations exist in directory layout, database schema placement, response validation, repository abstraction, and policy layer enforcement.

**Total violations identified:** 34 discrete issues across 11 rule categories.

| Severity | Count |
|----------|-------|
| Critical | 6     |
| High     | 12    |
| Medium   | 10    |
| Low      | 6     |

The most impactful violations are the absence of the `src/core/database/schema/` directory (all Drizzle table definitions live in `src/models/drizzle/`), the complete lack of Zod response validation in every controller, the absence of repository interfaces, and the missing `src/common/` directory that collapses framework utilities into `src/core/`.

---

## Severity Classification Summary

| # | Severity | Rule | Violation | Primary File(s) |
|---|----------|------|-----------|-----------------|
| 1 | Critical | 3 | Drizzle schemas in `src/models/drizzle/` instead of `src/core/database/schema/` | `src/models/drizzle/*.model.ts` (10 files) |
| 2 | Critical | 3 | Database module at `src/database/` instead of `src/core/database/` | `src/database/` (9 files) |
| 3 | Critical | 3 | No repository interfaces exist anywhere | All `*.repository.ts` files |
| 4 | Critical | 2 | No controller uses `.parse()` on response data | All `*.controller.ts` files |
| 5 | Critical | Structural | `src/common/` does not exist; framework utilities collapsed into `src/core/` | `src/core/` (11 subdirectories) |
| 6 | Critical | 3 | `postgres-store.service.ts` injects `DATABASE_CONNECTION` directly | `src/core/security-store/postgres-store.service.ts:5,26-27` |
| 7 | High | 3 | `drizzle.config.ts` points to wrong schema path | `drizzle.config.ts:4` |
| 8 | High | 7 | Auth guards and `@Roles()` applied directly in controllers without policy delegation | 7 controller files, 35 guard applications |
| 9 | High | 7 | 7 modules lack policy files entirely | `audit-log/`, `email-logs/`, `email-template/`, `system/`, `auth/`, `csrf/`, `health/` |
| 10 | High | 4 | Email templates use `Handlebars.compile()` from DB, not TypeScript template literals | `src/app/email-template/email-template.mapper.ts:1,24-26` |
| 11 | High | 4 | 770-line inline HTML template in root-level controller | `src/app.controller.ts:10-770` |
| 12 | High | Structural | `src/crypto/` at root level instead of `src/core/crypto/` | `src/crypto/crypto.module.ts`, `src/crypto/crypto.service.ts` |
| 13 | High | Structural | `src/models/drizzle/` at root level instead of `src/core/database/schema/` | `src/models/drizzle/` (10 files) |
| 14 | High | 1 | Empty scaffolded directories in `src/app/auth/` | `controllers/`, `repositories/`, `errors/` |
| 15 | High | 2 | Multiple auth schema files spread across subdirectories without consolidated `schemas/` grouping | `auth/core/`, `auth/session/`, `auth/two-factor/` |
| 16 | High | 11 | Commented-out dead code (MongoDB) in database cleaner | `src/database/clean.ts:4,16-36,81,84` |
| 17 | High | 11 | Commented-out dead code (phone validation) | `src/core/validators/common.schema.ts:279-285` |
| 18 | High | 3 | Dead/unused `DrizzleService` abstract class | `src/database/service.ts:1-38` |
| 19 | Medium | 1 | Single-file `@types/` subfolder in `email-logs/` | `src/app/email-logs/@types/email-log.types.ts` |
| 20 | Medium | 1 | Single-file `@types/` subfolder in `users/` | `src/app/users/@types/users.types.ts` |
| 21 | Medium | 1 | Single-file `@types/` subfolder in `email-template/` | `src/app/email-template/@types/email-template.types.ts` |
| 22 | Medium | 1 | Single-file `@types/` subfolder in `media/` | `src/app/media/@types/media.types.ts` |
| 23 | Medium | 1 | Single-file `services/` subfolder in `media/` | `src/app/media/services/cloudinary.service.ts` |
| 24 | Medium | 1 | Single-file `@types/` subfolder in `smtp/` | `src/app/smtp/@types/smtp.types.ts` |
| 25 | Medium | 1 | Single-file `interfaces/` subfolder in `smtp/` | `src/app/smtp/interfaces/email-provider.interface.ts` |
| 26 | Medium | 5 | `npm run` used instead of `pnpm run` | `src/database/clean.ts:86` |
| 27 | Medium | Structural | `src/@types/` at root level with single file | `src/@types/express.d.ts` |
| 28 | Medium | 4 | `AppController` at `src/` root instead of inside a feature module | `src/app.controller.ts` |
| 29 | Medium | 6 | Raw `throw new Error()` in helper (programming assertion) | `src/core/helpers/app.helper.ts:33` |
| 30 | Medium | 8 | API docs completeness not verified for all required sections | `docs/api/*.md` |
| 31 | Low | 6 | Raw `throw new Error()` in env validator (startup-time) | `src/core/validators/env.ts:109,180` |
| 32 | Low | 6 | Raw `throw new Error()` in seed CLI tool | `src/database/seed.ts:13` |
| 33 | Low | 9 | Planning doc gate compliance cannot be verified retroactively | `docs/planning/` |
| 34 | Low | 10 | Quality gate enforcement is a runtime behavior; no evidence in codebase | N/A |

---

## Detailed Findings by Rule

---

### Rule 1: File-Volume Directory Rule (Strict Flattener)

**Status:** 8 violations found

#### 1.1 Empty Scaffolded Directories in `src/app/auth/`

| Path | Contents |
|------|----------|
| `src/app/auth/controllers/` | Empty |
| `src/app/auth/repositories/` | Empty |
| `src/app/auth/errors/` | Empty |

**Severity:** High

**Recommended Fix:** Delete all three empty directories. If future expansion requires them, recreate at that time per the multi-file exception rule.

#### 1.2 Single-File Subfolders Violating the Flat Constraint

| Path | Single File | Recommended Action |
|------|-------------|-------------------|
| `src/app/email-logs/@types/` | `email-log.types.ts` | Move file to `src/app/email-logs/email-log.types.ts`, delete `@types/` |
| `src/app/users/@types/` | `users.types.ts` | Move file to `src/app/users/users.types.ts`, delete `@types/` |
| `src/app/email-template/@types/` | `email-template.types.ts` | Move file to `src/app/email-template/email-template.types.ts`, delete `@types/` |
| `src/app/media/@types/` | `media.types.ts` | Move file to `src/app/media/media.types.ts`, delete `@types/` |
| `src/app/media/services/` | `cloudinary.service.ts` | Move file to `src/app/media/cloudinary.service.ts`, delete `services/` |
| `src/app/smtp/@types/` | `smtp.types.ts` | Move file to `src/app/smtp/smtp.types.ts`, delete `@types/` |
| `src/app/smtp/interfaces/` | `email-provider.interface.ts` | Move file to `src/app/smtp/email-provider.interface.ts`, delete `interfaces/` |

**Severity:** Medium (each)

**Recommended Fix:** Flatten each single-file subfolder by moving the file to the feature module root and removing the now-empty directory. Update all import paths accordingly.

---

### Rule 2: The Request/Response Zod Mandate

**Status:** 2 violations found

#### 2.1 No Controllers Use `.parse()` on Response Data

**Affected files:** Every `*.controller.ts` in `src/app/`:
- `src/app/auth/auth.controller.ts`
- `src/app/users/users.controller.ts`
- `src/app/media/media.controller.ts`
- `src/app/smtp/smtp-providers.controller.ts`
- `src/app/audit-log/audit-log.controller.ts`
- `src/app/email-logs/email-logs.controller.ts`
- `src/app/email-template/email-template.controller.ts`
- `src/app/system/system.controller.ts`
- `src/app/csrf/csrf.controller.ts`
- `src/app/health/health.controller.ts`

**Rule text:** _"Every controller response must be explicitly parsed and sanitized synchronously using the corresponding Zod schema's `.parse()` method right before crossing the network barrier."_

**Current pattern:** Controllers delegate to services and return results directly or wrapped via `createApiResponse()` without Zod response schema validation.

**Severity:** Critical

**Recommended Fix:**
1. Define response schemas alongside input schemas for every endpoint.
2. Apply `ResponseSchema.parse(serviceResult)` as the final step in every controller method before returning.
3. Example:
   ```typescript
   @Get(':id')
   async findOne(@Param('id') id: string) {
     const raw = await this.usersService.findById(id);
     return UserResponseSchema.parse(raw);
   }
   ```

#### 2.2 Auth Schema Files Spread Across Subdirectories

**Affected files:**
- `src/app/auth/core/auth.schema.ts`
- `src/app/auth/core/password.schema.ts`
- `src/app/auth/session/session.schema.ts`
- `src/app/auth/two-factor/two-factor.schema.ts`

**Observation:** The auth module has 4 schema files across 3 subdirectories. Per the multi-file exception rule, these qualify for a consolidated `schemas/` directory.

**Severity:** High

**Recommended Fix:** Create `src/app/auth/schemas/` and move all schema files there:
- `src/app/auth/schemas/auth.schema.ts`
- `src/app/auth/schemas/password.schema.ts`
- `src/app/auth/schemas/session.schema.ts`
- `src/app/auth/schemas/two-factor.schema.ts`

Update all import paths.

---

### Rule 3: Database Isolation & Naming Standards

**Status:** 6 violations found

#### 3.1 Drizzle Table Definitions in Wrong Location

**Rule text:** _"All Drizzle table structures must live strictly inside `src/core/database/schema/[domain].schema.ts`."_

**Current location:** `src/models/drizzle/*.model.ts`

| File | `pgTable()` Definitions |
|------|------------------------|
| `src/models/drizzle/auth.model.ts` | Lines 19, 48, 79, 98, 118, 146 |
| `src/models/drizzle/audit-log.model.ts` | Line 17 |
| `src/models/drizzle/email-log.model.ts` | Line 15 |
| `src/models/drizzle/email-template.model.ts` | Line 17 |
| `src/models/drizzle/media.model.ts` | Line 15 |
| `src/models/drizzle/security-store.model.ts` | Line 11 |
| `src/models/drizzle/smtp-provider.model.ts` | Line 14 |
| `src/models/drizzle/system.model.ts` | Line 5 |
| `src/models/drizzle/enum.model.ts` | Enum definitions |
| `src/models/drizzle/relation.model.ts` | Relation definitions |

**Severity:** Critical

**Recommended Fix:**
1. Create `src/core/database/schema/`.
2. Move and rename all files:
   - `src/models/drizzle/auth.model.ts` → `src/core/database/schema/auth.schema.ts`
   - `src/models/drizzle/audit-log.model.ts` → `src/core/database/schema/audit-log.schema.ts`
   - (continue for all 10 files)
3. Update `drizzle.config.ts` line 4 to `['./src/core/database/schema']`.
4. Update all import paths across the codebase.
5. Delete `src/models/` entirely.

#### 3.2 Database Module at Wrong Location

**Current location:** `src/database/`
**Required location:** `src/core/database/`

**Files affected:**
- `src/database/clean.ts`
- `src/database/connection.ts`
- `src/database/database.module.ts`
- `src/database/helpers.ts`
- `src/database/schema.ts`
- `src/database/seed.ts`
- `src/database/seeds/`
- `src/database/service.ts`
- `src/database/types.ts`

**Severity:** Critical

**Recommended Fix:** Move the entire `src/database/` directory to `src/core/database/`. Update all import paths across the codebase.

#### 3.3 No Repository Interfaces Exist

**Rule text:** _"Core services must only access data providers via abstract repository interfaces (`[domain].repository.interface.ts`). Direct injection of the Drizzle database client into a service is a critical rule violation."_

**Current state:** All repositories are concrete classes injected directly into services. No `*.repository.interface.ts` files exist anywhere in the codebase.

**Affected modules:**
- `src/app/auth/core/auth.repository.ts`
- `src/app/auth/session/session.repository.ts`
- `src/app/auth/two-factor/two-factor.repository.ts`
- `src/app/users/users.repository.ts`
- `src/app/media/media.repository.ts`
- `src/app/smtp/smtp-providers.repository.ts`
- `src/app/audit-log/audit-log.repository.ts`
- `src/app/email-logs/email-logs.repository.ts`
- `src/app/email-template/email-template.repository.ts`
- `src/app/system/system.repository.ts`

**Severity:** Critical

**Recommended Fix:** For each repository:
1. Extract a public interface defining all methods.
2. Create `[domain].repository.interface.ts` with the abstract interface.
3. Have the concrete repository implement the interface.
4. Register the concrete class as a provider for the interface token.
5. Inject the interface token into services, not the concrete class.

#### 3.4 `drizzle.config.ts` Points to Wrong Schema Path

**File:** `drizzle.config.ts:4`
**Current value:** `const schemaPath = ['./src/models/drizzle'];`
**Required value:** `const schemaPath = ['./src/core/database/schema'];`

**Severity:** High (resolves automatically with fix 3.1)

#### 3.5 Direct Database Client Injection in `postgres-store.service.ts`

**File:** `src/core/security-store/postgres-store.service.ts`
**Lines:** 5, 26-27

```typescript
import { DATABASE_CONNECTION } from '../../database/connection';
// ...
@Inject(DATABASE_CONNECTION)
private readonly db: SecurityDb,
```

**Rule text:** _"Direct injection of the Drizzle database client into a service is a critical rule violation."_

**Severity:** Critical

**Recommended Fix:** Create a `SecurityStoreRepository` that wraps all Drizzle queries. Inject the repository into `PostgresSecurityStore` instead of the raw database client. Alternatively, since `PostgresSecurityStore` is itself a data access layer, reclassify it as a repository and ensure it is injected into services via an interface.

#### 3.6 Dead/Unused `DrizzleService` Abstract Class

**File:** `src/database/service.ts` (38 lines)

This abstract class injects `DATABASE_CONNECTION` directly and provides transaction context management. It appears to be unused dead code from an earlier architectural iteration.

**Severity:** High

**Recommended Fix:** Verify no class extends `DrizzleService`. If confirmed unused, delete the file entirely.

---

### Rule 4: Code-First System Actions

**Status:** 2 violations found

#### 4.1 Handlebars Templates from Database

**File:** `src/app/email-template/email-template.mapper.ts`
**Lines:** 1, 24-26

```typescript
import * as Handlebars from 'handlebars';
// ...
subject: Handlebars.compile(template.subject),
html: Handlebars.compile(template.html),
text: template.text ? Handlebars.compile(template.text) : undefined,
```

**Rule text:** _"Transactional emails must be built completely code-first inside a dedicated domain helper class. All templates must be compiled in memory using typesafe TypeScript template literals."_

**Current state:** Email templates are stored in the database as Handlebars strings and compiled at runtime using `Handlebars.compile()`. This is neither code-first nor typesafe TypeScript template literals.

**Severity:** High

**Recommended Fix:** This requires an architectural decision. Two options:
1. **Full compliance:** Replace DB-stored templates with code-first TypeScript template literal classes in `src/app/[feature]/emails/`. Remove Handlebars dependency.
2. **Pragmatic compromise:** If DB-stored templates are a product requirement (user-editable templates), document this as an intentional deviation and add type-safe wrapper validation around the Handlebars context objects.

#### 4.2 Massive Inline HTML in Root-Level Controller

**File:** `src/app.controller.ts`
**Lines:** 10-770 (760 lines of inline HTML template literal)

**Issues:**
- The file sits at `src/` root level instead of inside a feature module.
- Contains a 760-line HTML string literal for a status page.
- Violates the spirit of code-first templates (it is technically a TypeScript template literal, but is not a transactional email and is not in a dedicated helper class).

**Severity:** Medium

**Recommended Fix:** Move `AppController` into a dedicated feature module (e.g., `src/app/status/` or `src/app/root/`). Extract the HTML template into a dedicated builder class or template file within that module.

---

### Rule 5: Package Manager Lock-In

**Status:** 1 violation found

#### 5.1 `npm run` Used Instead of `pnpm run`

**File:** `src/database/clean.ts`
**Line:** 86

```typescript
commands.forEach(cmd => execSync(`npm run ${cmd}`, { stdio: 'inherit' }));
```

**Rule text:** _"pnpm is the only permitted package manager. All dependency installation commands must use `pnpm add` (runtime) or `pnpm add -D` (dev)."_

**Severity:** Medium

**Recommended Fix:** Replace `npm run` with `pnpm run`:
```typescript
commands.forEach(cmd => execSync(`pnpm run ${cmd}`, { stdio: 'inherit' }));
```

---

### Rule 6: Error Handling Architecture

**Status:** Mostly compliant — 3 minor observations

#### 6.1 Compliant Components

- `src/core/errors/domain-error.ts` — exists and well-structured.
- `src/core/filters/http-exception.filter.ts` — `GlobalExceptionFilter` formats responses correctly with all required fields (`statusCode`, `code`, `error`, `message`, `meta`, `timestamp`, `path`, `requestId`).
- No `domainError` field exposed in error responses.

#### 6.2 Raw `throw new Error()` Usage

| File | Line | Context | Severity |
|------|------|---------|----------|
| `src/core/validators/env.ts` | 109, 180 | Startup-time environment validation | Low |
| `src/core/helpers/app.helper.ts` | 33 | OTP length programming assertion | Medium |
| `src/database/seed.ts` | 13 | CLI seed tool | Low |

**Recommended Fix:**
- `env.ts`: Acceptable for startup-time validation before NestJS bootstraps. No change needed.
- `app.helper.ts`: Replace with `DomainError` or a more specific error type.
- `seed.ts`: Acceptable for CLI tooling. No change needed.

---

### Rule 7: RBAC & Policy Layer

**Status:** 2 violations found

#### 7.1 Modules Without Policy Files

**Rule text:** _"Role-based access control and ownership checks must live in dedicated policy files: `src/app/[feature]/[feature].policy.ts`. Business rules and authorization logic must never be placed in controllers or repositories."_

**Modules with policy files (compliant):**
- `src/app/users/users.policy.ts`
- `src/app/smtp/smtp-providers.policy.ts`
- `src/app/media/media.policy.ts`

**Modules without policy files (non-compliant):**
- `src/app/audit-log/` — uses `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('ADMIN')` directly in controller
- `src/app/email-logs/` — uses `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('ADMIN')` directly in controller
- `src/app/email-template/` — uses `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('ADMIN')` directly in controller
- `src/app/system/` — uses `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('ADMIN')` directly in controller
- `src/app/auth/` — uses 15+ `@UseGuards()` applications directly in controller
- `src/app/csrf/` — guard logic in controller
- `src/app/health/` — no guards (may be intentional for public health endpoint)

**Severity:** High

**Recommended Fix:**
1. Create `[feature].policy.ts` for each module that has authorization logic.
2. Move all `@Roles()` and authorization decision logic from controllers into policy classes.
3. Controllers should delegate authorization decisions to policies.
4. Guards remain in controllers for route-level protection, but the business rules they enforce should be defined in policies.

#### 7.2 Auth Guards Applied Directly in Controllers

**Total guard applications in controllers:** 35 instances across 7 controller files.

The `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('ADMIN')` pattern is applied directly on controller methods. While guards are a NestJS mechanism that must be applied at the controller level, the authorization business rules they encode should be defined in policy files and referenced by the guards.

**Severity:** High (combined with 7.1)

---

### Rule 8: API Documentation Obligation

**Status:** Requires content verification

#### 8.1 Existing API Documentation

| File | Module |
|------|--------|
| `docs/api/audit-logs.md` | Audit Log |
| `docs/api/auth.md` | Auth |
| `docs/api/csrf.md` | CSRF |
| `docs/api/health.md` | Health |
| `docs/api/media.md` | Media |
| `docs/api/smtp.md` | SMTP |
| `docs/api/system.md` | System |
| `docs/api/users.md` | Users |

**Required sections per doc:**
1. What the API does
2. How it works
3. Required parameters
4. Optional parameters
5. Auth/authorization requirements
6. Validation rules
7. Error responses
8. CSRF requirements (if applicable)
9. Example request body
10. Example successful response
11. Example error response

**Severity:** Medium

**Recommended Fix:** Audit each `docs/api/*.md` file against the 11 required sections. Add any missing sections. This should be done as part of each fix session when endpoints are modified.

---

### Rule 9: Planning Doc Gate

**Status:** Cannot verify retroactively

#### 9.1 Existing Planning Documents

| File | Feature |
|------|---------|
| `docs/planning/auth-magic-link.md` | Magic Link Authentication |
| `docs/planning/gap-resolution-plan.md` | Gap Resolution |
| `docs/planning/implementation-plan-phase-1.md` | Phase 1 Implementation |
| `docs/planning/phase-1-2-plan.md` | Phase 1-2 Implementation |
| `docs/planning/security-hardening.md` | Security Hardening |
| `docs/planning/two-factor-auth.md` | Two-Factor Authentication |
| `docs/planning/users-management.md` | User Management |

**Severity:** Low

**Recommended Fix:** Ensure all future non-trivial implementations have a corresponding planning document created before code changes begin. No retroactive action required.

---

### Rule 10: Quality Gate

**Status:** Cannot verify from codebase

**Rule text:** _"After every code change session, you must run and report the results of: `pnpm tsc --noEmit`, `pnpm lint`, and `pnpm build`."_

This is a runtime behavioral requirement. No evidence can be gathered from the codebase itself.

**Severity:** Low

**Recommended Fix:** Enforce via CI/CD pipeline or pre-commit hooks to ensure consistent execution.

---

### Rule 11: Production Constraints

**Status:** 2 violations found

#### 11.1 Commented-Out MongoDB Code in Database Cleaner

**File:** `src/database/clean.ts`
**Lines:** 4, 16-36, 81, 84

```typescript
// import mongoose from "mongoose";                          // Line 4
// private async clearMongoDatabase(): Promise<void> {       // Lines 16-36
//   ...21 lines of commented-out MongoDB cleanup...
// }
// await this.clearMongoDatabase();                          // Line 81
// const commands = ['db:generate', 'db:migrate'];           // Line 84
```

**Severity:** High

**Recommended Fix:** Remove all commented-out MongoDB code. The project uses PostgreSQL exclusively.

#### 11.2 Commented-Out Phone Validation

**File:** `src/core/validators/common.schema.ts`
**Lines:** 279-285

```typescript
// export const phoneWithCountryCodeRegex = /^\+?[1-9]\d{1,14}$/;
// export const validatePhoneNumber = (name: string) =>
//   baseString(name, { min: 1 })
//     .refine(value => phoneWithCountryCodeRegex.test(value), {
//       error: zodMessages.error.invalid.invalidPhoneNumber(name),
//     })
//     .transform(value => value.trim());
```

**Severity:** High

**Recommended Fix:** Remove the commented-out code. If the regex-based validation may be needed in the future, document the decision in a planning doc rather than leaving dead code.

---

### Additional Structural Violations

#### S.1 Missing `src/common/` Directory

**Rule expectation:** Framework utilities (constants, decorators, exceptions, filters, guards, interceptors, middleware, pipes, utils) under `src/common/`.

**Current state:** All framework utilities live under `src/core/`:
- `src/core/decorators/`
- `src/core/filters/`
- `src/core/guards/`
- `src/core/pipes/`
- `src/core/interceptors/`
- `src/core/middlewares/`
- `src/core/helpers/`
- `src/core/errors/`
- `src/core/validators/`
- `src/core/logging/`
- `src/core/security-store/`

**Severity:** Critical

**Recommended Fix:** This requires a significant restructuring decision. Two approaches:
1. **Split `src/core/` into `src/common/` and `src/core/`:** Move framework-level utilities (decorators, filters, guards, pipes, interceptors, middlewares) to `src/common/`. Keep infrastructure modules (config, database, errors, logger, mail, cache, security-store) in `src/core/`.
2. **Document intentional deviation:** If the current structure is a deliberate simplification, document it as an intentional architectural decision.

#### S.2 `src/crypto/` at Root Level

**Current location:** `src/crypto/`
**Expected location:** `src/core/crypto/`

**Files:**
- `src/crypto/crypto.module.ts`
- `src/crypto/crypto.service.ts`

**Severity:** High

**Recommended Fix:** Move `src/crypto/` to `src/core/crypto/`. Update all import paths.

#### S.3 `src/@types/` at Root Level

**Current location:** `src/@types/express.d.ts`

**Severity:** Medium

**Recommended Fix:** Move to `src/common/@types/express.d.ts` or keep at project root as `@types/express.d.ts` (TypeScript convention for ambient type declarations).

#### S.4 `src/app.controller.ts` at Root Level

**File:** `src/app.controller.ts` (770 lines)

This controller sits at the `src/` root level instead of inside a feature module. It serves a status page with a massive inline HTML template.

**Severity:** Medium

**Recommended Fix:** Move into a feature module (e.g., `src/app/status/status.controller.ts`). Extract the HTML template into a dedicated builder.

---

## Prioritized Action Plan

### Phase 1: Critical Structural Fixes (Immediate)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 1.1 | Move `src/database/` to `src/core/database/` | Medium | Resolves Rule 3.2 |
| 1.2 | Move `src/models/drizzle/` to `src/core/database/schema/` and rename `*.model.ts` to `*.schema.ts` | High | Resolves Rule 3.1 |
| 1.3 | Update `drizzle.config.ts` schema path | Low | Resolves Rule 3.4 |
| 1.4 | Update all import paths for database and schema moves | High | Completes 1.1 and 1.2 |
| 1.5 | Delete empty directories: `src/app/auth/controllers/`, `src/app/auth/repositories/`, `src/app/auth/errors/` | Low | Resolves Rule 1.1 |
| 1.6 | Move `src/crypto/` to `src/core/crypto/` | Low | Resolves S.2 |

### Phase 2: Repository Abstraction Layer (High Priority)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 2.1 | Define repository interfaces for all 10 repositories | High | Resolves Rule 3.3 |
| 2.2 | Refactor `PostgresSecurityStore` to use repository pattern or reclassify | Medium | Resolves Rule 3.5 |
| 2.3 | Delete dead `DrizzleService` class | Low | Resolves Rule 3.6 |

### Phase 3: Response Validation (High Priority)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 3.1 | Define Zod response schemas for all endpoints | High | Resolves Rule 2.1 |
| 3.2 | Add `.parse()` calls to all controller response paths | High | Completes Rule 2.1 |

### Phase 4: Policy Layer Enforcement (High Priority)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 4.1 | Create policy files for `audit-log`, `email-logs`, `email-template`, `system`, `auth` | High | Resolves Rule 7.1 |
| 4.2 | Move authorization business rules from controllers to policies | High | Resolves Rule 7.2 |

### Phase 5: Code Cleanup (Medium Priority)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 5.1 | Remove commented-out MongoDB code from `src/database/clean.ts` | Low | Resolves Rule 11.1 |
| 5.2 | Remove commented-out phone validation from `common.schema.ts` | Low | Resolves Rule 11.2 |
| 5.3 | Replace `npm run` with `pnpm run` in `src/database/clean.ts:86` | Low | Resolves Rule 5.1 |
| 5.4 | Flatten all single-file subfolders (7 directories) | Medium | Resolves Rule 1.2 |
| 5.5 | Consolidate auth schema files into `src/app/auth/schemas/` | Medium | Resolves Rule 2.2 |

### Phase 6: Template & Controller Cleanup (Medium Priority)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 6.1 | Move `src/app.controller.ts` into a feature module | Medium | Resolves S.4 |
| 6.2 | Evaluate Handlebars email template approach vs. code-first requirement | High | Resolves Rule 4.1 |
| 6.3 | Replace raw `throw new Error()` in `app.helper.ts:33` with `DomainError` | Low | Resolves Rule 6.2 |

### Phase 7: Documentation & Verification (Ongoing)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 7.1 | Audit all `docs/api/*.md` files for required section completeness | Medium | Resolves Rule 8.1 |
| 7.2 | Decide on `src/common/` vs `src/core/` structure and document | Medium | Resolves S.1 |
| 7.3 | Run quality gate: `pnpm tsc --noEmit`, `pnpm lint`, `pnpm build` after each phase | Low | Resolves Rule 10 |

---

## Compliance Scorecard

| Rule | Status | Score |
|------|--------|-------|
| 1. File-Volume Directory Rule | Partial Compliance | 6/10 |
| 2. Request/Response Zod Mandate | Input compliant, response non-compliant | 4/10 |
| 3. Database Isolation & Naming | Non-compliant | 2/10 |
| 4. Code-First System Actions | Partial compliance | 5/10 |
| 5. Package Manager Lock-In | One violation | 9/10 |
| 6. Error Handling Architecture | Mostly compliant | 9/10 |
| 7. RBAC & Policy Layer | Partial compliance | 4/10 |
| 8. API Documentation Obligation | Exists, completeness unverified | 7/10 |
| 9. Planning Doc Gate | Cannot verify | N/A |
| 10. Quality Gate | Cannot verify | N/A |
| 11. Production Constraints | Two dead-code violations | 7/10 |
| Structural Layout | Significant deviations | 4/10 |

**Overall Compliance Score: 5.7 / 10**
