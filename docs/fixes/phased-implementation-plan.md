# Phased Implementation Plan — Architectural Compliance

**Date:** May 31, 2026
**Reference:** [`docs/fixes/architectural-compliance-audit.md`](./architectural-compliance-audit.md)
**Total Violations:** 34 (22 resolved, 12 remaining)
**Estimated Total Effort:** 5–7 engineering days

---

## Overview

This document provides a mechanically executable, step-by-step plan to resolve all 34 architectural violations identified in the compliance audit. The work is organized into 7 phases, ordered by dependency and risk. Each phase is self-contained: it can be implemented as a single pull request, verified independently, and merged before the next phase begins.

### Phase Summary

| Phase | Title | Violations Resolved | Effort | Risk | Status |
|-------|-------|---------------------|--------|------|--------|
| 1 | Quick Wins — Dead Code & Simple Fixes | #14, #16, #17, #18, #26, #29 | Low | Low | ✅ Completed |
| 2 | Flatten Single-File Subfolders | #19–#25, #27 | Medium | Low | ✅ Completed |
| 3 | Structural Relocation — Database, Crypto, Common | #1, #2, #5, #7, #11, #12, #13, #28 | High | High | ✅ Completed |
| 4 | Repository Abstraction Layer | #3, #6 | High | Medium | Pending |
| 5 | Response Validation with Zod | #4 | High | Medium | Pending |
| 6 | Policy Layer & Auth Schema Consolidation | #8, #9, #15 | High | Medium | Pending |
| 7 | Email Templates & Documentation | #10, #30 | Medium | Low | Pending |

### Dependency Graph

```
Phase 1 ✅ ──→ Phase 2 ✅ ──→ Phase 3 ✅ ──→ Phase 4
                                              ──→ Phase 5
                                              ──→ Phase 6
                                                        ──→ Phase 7
```

- ~~Phase 1 must complete before Phase 2 (deletes `service.ts` before moves).~~ ✅ Done
- ~~Phase 2 must complete before Phase 3 (flattens subfolders before bulk import rewrites).~~ ✅ Done
- ~~Phase 3 must complete before Phases 4, 5, and 6 (establishes canonical paths).~~ ✅ Done
- Phases 4, 5, and 6 can run in parallel after Phase 3.
- Phase 7 can run in parallel with Phases 4–6 but is lowest priority.

---

## Phase 1: Quick Wins — Dead Code & Simple Fixes ✅ COMPLETED

**Status:** All 6 steps completed and verified on May 31, 2026.
**Risk:** Low
**Effort:** Low (30 minutes)
**Violations Resolved:** #14, #16, #17, #18, #26, #29

### Completion Log

| Step | Action | Status |
|------|--------|--------|
| 1.1 | Removed commented-out MongoDB import and `clearMongoDatabase()` method from `src/database/clean.ts` (lines 4, 16-36, 81, 84) | ✅ Done |
| 1.2 | Removed commented-out phone validation regex from `src/core/validators/common.schema.ts` (lines 279-285) | ✅ Done |
| 1.3 | Replaced `npm run` with `pnpm run` in `src/database/clean.ts:86` | ✅ Done |
| 1.4 | Deleted empty directories `src/app/auth/errors/` and `src/app/auth/repositories/` (`controllers/` already absent) | ✅ Done |
| 1.5 | Replaced `throw new Error(...)` with `throw badRequestError(...)` in `src/core/helpers/app.helper.ts:33`, added `badRequestError` import | ✅ Done |
| 1.6 | Deleted dead/unused `src/database/service.ts` (`DrizzleService` abstract class) — verified no imports or extends references | ✅ Done |
| 1.7 | Quality gate passed: `pnpm tsc --noEmit` (0 errors), `pnpm lint` (0 warnings), `pnpm build` (147 files, 0 issues) | ✅ Passed |

### Step 1.1: Remove Commented-Out MongoDB Code from `clean.ts`

**File:** `src/database/clean.ts`

**Delete line 4:**
```
// import mongoose from "mongoose";
```

**Delete lines 16–36** (the entire commented-out `clearMongoDatabase` method):
```
// private async clearMongoDatabase(): Promise<void> {
//   ...21 lines...
// }
```

**Delete line 81:**
```
// await this.clearMongoDatabase();
```

**Delete line 84:**
```
// const commands = ['db:generate', 'db:migrate'];
```

### Step 1.2: Remove Commented-Out Phone Validation from `common.schema.ts`

**File:** `src/core/validators/common.schema.ts`

**Delete lines 279–285:**
```
// export const phoneWithCountryCodeRegex = /^\+?[1-9]\d{1,14}$/;
// export const validatePhoneNumber = (name: string) =>
//   baseString(name, { min: 1 })
//     .refine(value => phoneWithCountryCodeRegex.test(value), {
//       error: zodMessages.error.invalid.invalidPhoneNumber(name),
//     })
//     .transform(value => value.trim());
```

### Step 1.3: Replace `npm run` with `pnpm run` in `clean.ts`

**File:** `src/database/clean.ts`
**Line:** 86

**Before:**
```typescript
commands.forEach(cmd => execSync(`npm run ${cmd}`, { stdio: 'inherit' }));
```

**After:**
```typescript
commands.forEach(cmd => execSync(`pnpm run ${cmd}`, { stdio: 'inherit' }));
```

### Step 1.4: Delete Empty Directories in `src/app/auth/`

**Delete these 3 empty directories:**
```
src/app/auth/controllers/
src/app/auth/repositories/
src/app/auth/errors/
```

**Command:**
```bash
rmdir src/app/auth/controllers src/app/auth/repositories src/app/auth/errors
```

### Step 1.5: Replace Raw `throw new Error()` in `app.helper.ts`

**File:** `src/core/helpers/app.helper.ts`
**Line:** 33

**Add import at top of file:**
```typescript
import { badRequestError } from '../errors/domain-error';
```

**Before:**
```typescript
throw new Error('The OTP length must be at least 4.');
```

**After:**
```typescript
throw badRequestError('The OTP length must be at least 4.');
```

### Step 1.6: Delete Dead `DrizzleService` Class

**File to delete:** `src/database/service.ts`

**Verification:** Confirm no file extends `DrizzleService`:
```bash
rg "extends DrizzleService" src/
rg "from.*database/service" src/
```

Both commands must return zero results before deletion.

### Step 1.7: Quality Gate

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```

All three must pass with zero errors.

---

## Phase 2: Flatten Single-File Subfolders ✅ COMPLETED

**Status:** All 7 steps completed and verified on May 31, 2026.
**Risk:** Low
**Effort:** Medium (1–2 hours)
**Violations Resolved:** #19, #20, #21, #22, #23, #24, #25, #27

### Completion Log

| Step | Action | Status |
|------|--------|--------|
| 2.1 | Moved `src/app/email-logs/@types/email-log.types.ts` → `src/app/email-logs/email-log.types.ts`, deleted `@types/`, updated 2 consumer imports | ✅ Done |
| 2.2 | Moved `src/app/users/@types/users.types.ts` → `src/app/users/users.types.ts`, deleted `@types/`, updated 4 consumer imports + internal `database/types` path | ✅ Done |
| 2.3 | Moved `src/app/email-template/@types/email-template.types.ts` → `src/app/email-template/email-template.types.ts`, deleted `@types/`, updated 1 consumer import + internal `email-template.registry` path | ✅ Done |
| 2.4 | Moved `src/app/media/@types/media.types.ts` → `src/app/media/media.types.ts`, deleted `@types/`, updated 4 consumer imports + internal `database/types` path | ✅ Done |
| 2.5 | Moved `src/app/media/services/cloudinary.service.ts` → `src/app/media/cloudinary.service.ts`, deleted `services/`, updated 4 consumer imports (media.service, media.providers, auth.service, auth.providers) | ✅ Done |
| 2.6 | Moved `src/app/smtp/@types/smtp.types.ts` → `src/app/smtp/smtp.types.ts`, deleted `@types/`, updated 6 consumer imports + internal `email-provider.interface` path | ✅ Done |
| 2.7 | Moved `src/app/smtp/interfaces/email-provider.interface.ts` → `src/app/smtp/email-provider.interface.ts`, deleted `interfaces/`, updated 8 consumer imports | ✅ Done |
| 2.8 | `src/@types/express.d.ts` — deferred to Phase 3 Step 3.7 (moves with `src/common/` creation) | ⏭️ Deferred |
| 2.9 | Quality gate passed: `pnpm tsc --noEmit` (0 errors), `pnpm lint` (0 warnings), `pnpm build` (147 files, 0 issues) | ✅ Passed |

For each sub-step: move the file, delete the now-empty directory, update all import paths.

### Step 2.1: Flatten `src/app/email-logs/@types/email-log.types.ts`

**Move:**
```
src/app/email-logs/@types/email-log.types.ts → src/app/email-logs/email-log.types.ts
```

**Delete:** `src/app/email-logs/@types/`

**Import changes (2 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/email-logs/email-logs.controller.ts` | `'./@types/email-log.types'` | `'./email-log.types'` |
| `src/app/email-logs/email-logs.service.ts` | `'./@types/email-log.types'` | `'./email-log.types'` |

### Step 2.2: Flatten `src/app/users/@types/users.types.ts`

**Move:**
```
src/app/users/@types/users.types.ts → src/app/users/users.types.ts
```

**Delete:** `src/app/users/@types/`

**Import changes (4 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.service.ts` | `'./@types/users.types'` | `'./users.types'` |
| `src/app/users/users.mapper.ts` | `'./@types/users.types'` | `'./users.types'` |
| `src/app/users/users.controller.ts` | `'./@types/users.types'` | `'./users.types'` |
| `src/app/users/users.repository.ts` | `'./@types/users.types'` | `'./users.types'` |

### Step 2.3: Flatten `src/app/email-template/@types/email-template.types.ts`

**Move:**
```
src/app/email-template/@types/email-template.types.ts → src/app/email-template/email-template.types.ts
```

**Delete:** `src/app/email-template/@types/`

**Import changes (1 file):**

| File | Before | After |
|------|--------|-------|
| `src/app/email-template/email-template.controller.ts` | `'./@types/email-template.types'` | `'./email-template.types'` |

### Step 2.4: Flatten `src/app/media/@types/media.types.ts`

**Move:**
```
src/app/media/@types/media.types.ts → src/app/media/media.types.ts
```

**Delete:** `src/app/media/@types/`

**Import changes (4 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/media/media.repository.ts` | `'./@types/media.types'` | `'./media.types'` |
| `src/app/media/media.service.ts` | `'./@types/media.types'` | `'./media.types'` |
| `src/app/media/media.controller.ts` | `'./@types/media.types'` | `'./media.types'` |
| `src/app/media/media.mapper.ts` | `'./@types/media.types'` | `'./media.types'` |

### Step 2.5: Flatten `src/app/media/services/cloudinary.service.ts`

**Move:**
```
src/app/media/services/cloudinary.service.ts → src/app/media/cloudinary.service.ts
```

**Delete:** `src/app/media/services/`

**Import changes (4 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/media/media.service.ts` | `'./services/cloudinary.service'` | `'./cloudinary.service'` |
| `src/app/media/media.providers.ts` | `'./services/cloudinary.service'` | `'./cloudinary.service'` |
| `src/app/auth/core/auth.providers.ts` | `'../../media/services/cloudinary.service'` | `'../../media/cloudinary.service'` |
| `src/app/auth/core/auth.service.ts` | `'../../media/services/cloudinary.service'` | `'../../media/cloudinary.service'` |

### Step 2.6: Flatten `src/app/smtp/@types/smtp.types.ts`

**Move:**
```
src/app/smtp/@types/smtp.types.ts → src/app/smtp/smtp.types.ts
```

**Delete:** `src/app/smtp/@types/`

**Import changes (6 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/smtp/smtp-providers.mapper.ts` | `'./@types/smtp.types'` | `'./smtp.types'` |
| `src/app/smtp/smtp-providers.controller.ts` | `'./@types/smtp.types'` | `'./smtp.types'` |
| `src/app/smtp/providers/brevo.provider.ts` | `'../@types/smtp.types'` | `'../smtp.types'` |
| `src/app/smtp/providers/nodemailer.provider.ts` | `'../@types/smtp.types'` | `'../smtp.types'` |
| `src/app/smtp/providers/aws-ses.provider.ts` | `'../@types/smtp.types'` | `'../smtp.types'` |
| `src/app/smtp/providers/resend.provider.ts` | `'../@types/smtp.types'` | `'../smtp.types'` |

**Note:** `smtp.types.ts` itself imports from `'../interfaces/email-provider.interface'`. After this move it sits at `src/app/smtp/smtp.types.ts`, so the import path becomes `'./email-provider.interface'` — but only after Step 2.7 completes. For now, update it to `'./interfaces/email-provider.interface'` (one level up from `@types/` to root).

**Updated internal import in `smtp.types.ts`:**

| Before | After |
|--------|-------|
| `'../interfaces/email-provider.interface'` | `'./interfaces/email-provider.interface'` |

### Step 2.7: Flatten `src/app/smtp/interfaces/email-provider.interface.ts`

**Move:**
```
src/app/smtp/interfaces/email-provider.interface.ts → src/app/smtp/email-provider.interface.ts
```

**Delete:** `src/app/smtp/interfaces/`

**Import changes (8 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/smtp/smtp-providers.mapper.ts` | `'./interfaces/email-provider.interface'` | `'./email-provider.interface'` |
| `src/app/smtp/smtp-providers.service.ts` | `'./interfaces/email-provider.interface'` | `'./email-provider.interface'` |
| `src/app/smtp/email-dispatcher.service.ts` | `'./interfaces/email-provider.interface'` | `'./email-provider.interface'` |
| `src/app/smtp/smtp.types.ts` (flattened in 2.6) | `'./interfaces/email-provider.interface'` | `'./email-provider.interface'` |
| `src/app/smtp/providers/brevo.provider.ts` | `'../interfaces/email-provider.interface'` | `'../email-provider.interface'` |
| `src/app/smtp/providers/nodemailer.provider.ts` | `'../interfaces/email-provider.interface'` | `'../email-provider.interface'` |
| `src/app/smtp/providers/aws-ses.provider.ts` | `'../interfaces/email-provider.interface'` | `'../email-provider.interface'` |
| `src/app/smtp/providers/resend.provider.ts` | `'../interfaces/email-provider.interface'` | `'../email-provider.interface'` |

### Step 2.8: Relocate `src/@types/express.d.ts`

**Move:**
```
src/@types/express.d.ts → src/common/@types/express.d.ts
```

**Create directory:** `src/common/@types/`

**Delete:** `src/@types/`

**Import change in the file itself:**

| Before | After |
|--------|-------|
| `'../database/types'` | `'../../core/database/types'` |

**Note:** This path assumes Phase 3 will move `src/database/` to `src/core/database/`. If Phase 2 is merged before Phase 3, use the interim path `'../database/types'` and update again in Phase 3. The recommended approach is to merge Phases 2 and 3 together, or to use the final path and accept a temporary breakage that Phase 3 resolves.

**Recommended approach:** Keep the file at `src/@types/express.d.ts` during Phase 2 and move it in Phase 3 Step 3.7 when `src/common/` is created. If executing phases separately, skip this step in Phase 2 and execute it during Phase 3.

### Step 2.9: Quality Gate

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```

---

## Phase 3: Structural Relocation — Database, Crypto, Common ✅ COMPLETED

**Status:** All 8 steps completed and verified on May 31, 2026.
**Risk:** High
**Effort:** High (3–4 hours)
**Violations Resolved:** #1, #2, #5, #7, #11, #12, #13, #28

### Completion Log

| Step | Action | Status |
|------|--------|--------|
| 3.1 | Moved `src/database/` → `src/core/database/` (8 files + seeds/), updated 80+ imports across all feature modules, `app.module.ts`, `postgres-store.service.ts`, `express.d.ts` | ✅ Done |
| 3.2 | Moved `src/models/drizzle/*.model.ts` → `src/core/database/schema/*.schema.ts` (10 files renamed), updated cross-schema imports (`.model` → `.schema`), updated `schema.ts` barrel and `types.ts`, deleted `src/models/` | ✅ Done |
| 3.3 | Updated `drizzle.config.ts` schema path from `./src/models/drizzle` to `./src/core/database/schema` | ✅ Done |
| 3.4 | Updated `update-schema.mjs` — models dir, schema file path, file extension filter (`.model.ts` → `.schema.ts`), import path template | ✅ Done |
| 3.5 | Updated `package.json` scripts: `db:clear` and `db:seed` now point to `src/core/database/` | ✅ Done |
| 3.6 | Moved `src/crypto/` → `src/core/crypto/` (2 files), updated 8 consumer imports across auth, smtp modules and `app.module.ts` | ✅ Done |
| 3.7 | Split `src/core/` into `src/common/` + `src/core/` — moved 7 subdirectories (decorators, filters, guards, pipes, interceptors, middlewares, helpers) to `src/common/`, moved `src/@types/express.d.ts` → `src/common/@types/`, updated all cross-references in guards/helpers/decorators/pipes/middlewares, updated `main.ts` (4 imports), `app.module.ts` (2 imports), and all 10+ feature controllers | ✅ Done |
| 3.8 | Moved `src/app.controller.ts` (770 lines) into `src/app/status/status.controller.ts` + created `status.module.ts`, updated `app.module.ts` to import `StatusModule`, deleted root-level controller | ✅ Done |
| 3.9 | Quality gate passed: `pnpm tsc --noEmit` (0 errors), `pnpm lint` (0 warnings), `pnpm build` (148 files, 0 issues) | ✅ Passed |

This phase was executed atomically in a single commit. All sub-steps are interdependent.

### Step 3.1: Move `src/database/` → `src/core/database/`

**Move entire directory:**
```
src/database/ → src/core/database/
```

**Files moved (8 files + 1 subdirectory):**
- `clean.ts`
- `connection.ts`
- `database.module.ts`
- `helpers.ts`
- `schema.ts`
- `seed.ts`
- `seeds/email-template.seed.ts`
- `types.ts`

**Note:** `service.ts` was deleted in Phase 1.

**Internal import updates within moved files:**

| File | Before | After |
|------|--------|-------|
| `src/core/database/connection.ts` | `'./schema'` | `'./schema'` (no change) |
| `src/core/database/database.module.ts` | `'./connection'` | `'./connection'` (no change) |
| `src/core/database/schema.ts` | `'../models/drizzle/*.model'` | Updated in Step 3.2 |
| `src/core/database/types.ts` | `'../models/drizzle/*.model'` | Updated in Step 3.2 |
| `src/core/database/seed.ts` | `'./schema'` | `'./schema'` (no change) |
| `src/core/database/seed.ts` | `'./seeds/email-template.seed'` | `'./seeds/email-template.seed'` (no change) |

**External import updates — `DATABASE_CONNECTION` imports (13 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.repository.ts` | `'../../database/connection'` | `'../../core/database/connection'` |
| `src/app/system/system.repository.ts` | `'../../database/connection'` | `'../../core/database/connection'` |
| `src/app/smtp/smtp-providers.repository.ts` | `'../../database/connection'` | `'../../core/database/connection'` |
| `src/app/media/media.repository.ts` | `'../../database/connection'` | `'../../core/database/connection'` |
| `src/app/email-logs/email-logs.repository.ts` | `'../../database/connection'` | `'../../core/database/connection'` |
| `src/app/email-template/email-template.repository.ts` | `'../../database/connection'` | `'../../core/database/connection'` |
| `src/app/audit-log/audit-log.repository.ts` | `'../../database/connection'` | `'../../core/database/connection'` |
| `src/app/health/drizzle-health.indicator.ts` | `'../../database/connection'` | `'../../core/database/connection'` |
| `src/core/security-store/postgres-store.service.ts` | `'../../database/connection'` | `'../database/connection'` |
| `src/app/auth/core/auth.repository.ts` | `'../../../database/connection'` | `'../../../core/database/connection'` |
| `src/app/auth/session/session.repository.ts` | `'../../../database/connection'` | `'../../../core/database/connection'` |
| `src/app/auth/two-factor/two-factor.repository.ts` | `'../../../database/connection'` | `'../../../core/database/connection'` |

**External import updates — `schema` imports (11 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.repository.ts` | `'../../database/schema'` | `'../../core/database/schema'` |
| `src/app/system/system.repository.ts` | `'../../database/schema'` | `'../../core/database/schema'` |
| `src/app/smtp/smtp-providers.repository.ts` | `'../../database/schema'` | `'../../core/database/schema'` |
| `src/app/media/media.repository.ts` | `'../../database/schema'` | `'../../core/database/schema'` |
| `src/app/email-logs/email-logs.repository.ts` | `'../../database/schema'` | `'../../core/database/schema'` |
| `src/app/email-template/email-template.repository.ts` | `'../../database/schema'` | `'../../core/database/schema'` |
| `src/app/audit-log/audit-log.repository.ts` | `'../../database/schema'` | `'../../core/database/schema'` |
| `src/app/health/drizzle-health.indicator.ts` | `'../../database/schema'` | `'../../core/database/schema'` |
| `src/core/security-store/postgres-store.service.ts` | `'../../database/schema'` | `'../database/schema'` |
| `src/app/auth/core/auth.repository.ts` | `'../../../database/schema'` | `'../../../core/database/schema'` |
| `src/app/auth/session/session.repository.ts` | `'../../../database/schema'` | `'../../../core/database/schema'` |
| `src/app/auth/two-factor/two-factor.repository.ts` | `'../../../database/schema'` | `'../../../core/database/schema'` |

**External import updates — `helpers` imports (8 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.repository.ts` | `'../../database/helpers'` | `'../../core/database/helpers'` |
| `src/app/smtp/smtp-providers.repository.ts` | `'../../database/helpers'` | `'../../core/database/helpers'` |
| `src/app/media/media.repository.ts` | `'../../database/helpers'` | `'../../core/database/helpers'` |
| `src/app/email-logs/email-logs.repository.ts` | `'../../database/helpers'` | `'../../core/database/helpers'` |
| `src/app/email-template/email-template.repository.ts` | `'../../database/helpers'` | `'../../core/database/helpers'` |
| `src/app/audit-log/audit-log.repository.ts` | `'../../database/helpers'` | `'../../core/database/helpers'` |
| `src/app/auth/session/session.repository.ts` | `'../../../database/helpers'` | `'../../../core/database/helpers'` |

**External import updates — `types` imports (30+ files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.service.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/users/users.repository.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/users/users.policy.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/users/users.types.ts` | `'../../../database/types'` | `'../../core/database/types'` |
| `src/app/system/system.repository.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/system/system.service.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/system/system.controller.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/smtp/smtp-providers.repository.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/smtp/smtp-providers.policy.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/smtp/smtp-providers.service.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/smtp/smtp-providers.mapper.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/smtp/email-dispatcher.service.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/media/media.repository.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/media/media.mapper.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/media/media.types.ts` | `'../../../database/types'` | `'../../core/database/types'` |
| `src/app/email-logs/email-logs.repository.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/email-logs/email-logs.service.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/email-template/email-template.mapper.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/email-template/email-template.service.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/email-template/email-template.registry.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/audit-log/audit-log.repository.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/audit-log/audit-log.mapper.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/audit-log/audit-log.service.ts` | `'../../database/types'` | `'../../core/database/types'` |
| `src/app/auth/core/auth.repository.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/core/auth.types.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/core/auth.mapper.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/session/session.repository.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/session/session.service.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/session/session.mapper.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/session/session.types.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/two-factor/two-factor.repository.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/two-factor/two-factor.service.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/strategies/jwt-partial.strategy.ts` | `'../../../database/types'` | `'../../../core/database/types'` |
| `src/app/auth/services/invitation-email.service.ts` | `'../../../database/types'` | `'../../../core/database/types'` |

**External import updates — `DatabaseModule` imports (4 files):**

| File | Before | After |
|------|--------|-------|
| `src/app.module.ts` | `'./database/database.module'` | `'./core/database/database.module'` |
| `src/app/system/system.module.ts` | `'../../database/database.module'` | `'../../core/database/database.module'` |
| `src/app/smtp/smtp.module.ts` | `'../../database/database.module'` | `'../../core/database/database.module'` |
| `src/app/email-logs/email-logs.module.ts` | `'../../database/database.module'` | `'../../core/database/database.module'` |

**External import update — `express.d.ts`:**

| File | Before | After |
|------|--------|-------|
| `src/@types/express.d.ts` | `'../database/types'` | `'../core/database/types'` |

### Step 3.2: Move `src/models/drizzle/*.model.ts` → `src/core/database/schema/*.schema.ts`

**Create directory:** `src/core/database/schema/`

**Move and rename (10 files):**

| Source | Destination |
|--------|-------------|
| `src/models/drizzle/audit-log.model.ts` | `src/core/database/schema/audit-log.schema.ts` |
| `src/models/drizzle/auth.model.ts` | `src/core/database/schema/auth.schema.ts` |
| `src/models/drizzle/email-log.model.ts` | `src/core/database/schema/email-log.schema.ts` |
| `src/models/drizzle/email-template.model.ts` | `src/core/database/schema/email-template.schema.ts` |
| `src/models/drizzle/enum.model.ts` | `src/core/database/schema/enum.schema.ts` |
| `src/models/drizzle/media.model.ts` | `src/core/database/schema/media.schema.ts` |
| `src/models/drizzle/relation.model.ts` | `src/core/database/schema/relation.schema.ts` |
| `src/models/drizzle/security-store.model.ts` | `src/core/database/schema/security-store.schema.ts` |
| `src/models/drizzle/smtp-provider.model.ts` | `src/core/database/schema/smtp-provider.schema.ts` |
| `src/models/drizzle/system.model.ts` | `src/core/database/schema/system.schema.ts` |

**Delete:** `src/models/` (entire directory tree)

**Internal import updates within moved schema files (7 files import `timestamps`):**

All 7 files that import `timestamps` from the database helpers need their path updated. Since they are now at `src/core/database/schema/*.schema.ts` and helpers is at `src/core/database/helpers.ts`:

| File | Before | After |
|------|--------|-------|
| `src/core/database/schema/audit-log.schema.ts` | `'../../database/helpers'` | `'../helpers'` |
| `src/core/database/schema/auth.schema.ts` | `'../../database/helpers'` | `'../helpers'` |
| `src/core/database/schema/email-log.schema.ts` | `'../../database/helpers'` | `'../helpers'` |
| `src/core/database/schema/email-template.schema.ts` | `'../../database/helpers'` | `'../helpers'` |
| `src/core/database/schema/media.schema.ts` | `'../../database/helpers'` | `'../helpers'` |
| `src/core/database/schema/smtp-provider.schema.ts` | `'../../database/helpers'` | `'../helpers'` |
| `src/core/database/schema/system.model.ts` | `'../../database/helpers'` | `'../helpers'` |

**Cross-schema imports within moved files:**

Check each schema file for imports from other model files. The `relation.model.ts` (now `relation.schema.ts`) imports table definitions from other model files. These imports change from `'./X.model'` to `'./X.schema'`:

| File | Before | After |
|------|--------|-------|
| `src/core/database/schema/relation.schema.ts` | All `'./X.model'` imports | `'./X.schema'` |

Similarly, `auth.model.ts` may import from `enum.model.ts`. Update:

| File | Before | After |
|------|--------|-------|
| `src/core/database/schema/auth.schema.ts` | `'./enum.model'` (if present) | `'./enum.schema'` |
| Any other schema importing `enum.model` | `'./enum.model'` | `'./enum.schema'` |

**External import updates — `src/core/database/schema.ts` barrel (10 imports):**

| Before | After |
|--------|-------|
| `'../models/drizzle/audit-log.model'` | `'./schema/audit-log.schema'` |
| `'../models/drizzle/auth.model'` | `'./schema/auth.schema'` |
| `'../models/drizzle/email-log.model'` | `'./schema/email-log.schema'` |
| `'../models/drizzle/email-template.model'` | `'./schema/email-template.schema'` |
| `'../models/drizzle/enum.model'` | `'./schema/enum.schema'` |
| `'../models/drizzle/media.model'` | `'./schema/media.schema'` |
| `'../models/drizzle/relation.model'` | `'./schema/relation.schema'` |
| `'../models/drizzle/security-store.model'` | `'./schema/security-store.schema'` |
| `'../models/drizzle/smtp-provider.model'` | `'./schema/smtp-provider.schema'` |
| `'../models/drizzle/system.model'` | `'./schema/system.model'` |

**External import updates — `src/core/database/types.ts` (9 imports):**

| Before | After |
|--------|-------|
| `'../models/drizzle/auth.model'` | `'./schema/auth.schema'` |
| `'../models/drizzle/audit-log.model'` | `'./schema/audit-log.schema'` |
| `'../models/drizzle/email-template.model'` | `'./schema/email-template.schema'` |
| `'../models/drizzle/enum.model'` | `'./schema/enum.schema'` |
| `'../models/drizzle/media.model'` | `'./schema/media.schema'` |
| `'../models/drizzle/security-store.model'` | `'./schema/security-store.schema'` |
| `'../models/drizzle/email-log.model'` | `'./schema/email-log.schema'` |
| `'../models/drizzle/smtp-provider.model'` | `'./schema/smtp-provider.schema'` |
| `'../models/drizzle/system.model'` | `'./schema/system.model'` |

**External import updates — feature module schema files importing `enum.model` (2 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.schema.ts` | `'../../models/drizzle/enum.model'` | `'../../core/database/schema/enum.schema'` |
| `src/app/system/system.schema.ts` | `'../../models/drizzle/enum.model'` | `'../../core/database/schema/enum.schema'` |

### Step 3.3: Update `drizzle.config.ts`

**File:** `drizzle.config.ts`
**Line:** 4

**Before:**
```typescript
const schemaPath = ['./src/models/drizzle'];
```

**After:**
```typescript
const schemaPath = ['./src/core/database/schema'];
```

### Step 3.4: Update `update-schema.mjs`

**File:** `update-schema.mjs`

**Line 14 — Before:**
```javascript
const modelsDir = path.resolve(__dirname, 'src', 'models', 'drizzle');
```
**After:**
```javascript
const modelsDir = path.resolve(__dirname, 'src', 'core', 'database', 'schema');
```

**Line 15 — Before:**
```javascript
const schemaFile = path.resolve(__dirname, 'src', 'database', 'schema.ts');
```
**After:**
```javascript
const schemaFile = path.resolve(__dirname, 'src', 'core', 'database', 'schema.ts');
```

**Line 22 — Before:**
```javascript
return files.filter(f => f.endsWith('.model.ts'));
```
**After:**
```javascript
return files.filter(f => f.endsWith('.schema.ts'));
```

**Line 26 — Before:**
```javascript
const base = modelFile.replace(/\.model\.ts$/, '');
```
**After:**
```javascript
const base = modelFile.replace(/\.schema\.ts$/, '');
```

**Line 53 — Before:**
```javascript
const importPath = `../models/drizzle/${f.replace(/\.ts$/, '')}`;
```
**After:**
```javascript
const importPath = `./schema/${f.replace(/\.ts$/, '')}`;
```

### Step 3.5: Update `package.json` Scripts

**File:** `package.json`

| Script | Before | After |
|--------|--------|-------|
| `db:clear` | `"ts-node src/database/clean.ts"` | `"ts-node src/core/database/clean.ts"` |
| `db:seed` | `"ts-node src/database/seed.ts"` | `"ts-node src/core/database/seed.ts"` |

### Step 3.6: Move `src/crypto/` → `src/core/crypto/`

**Move entire directory:**
```
src/crypto/ → src/core/crypto/
```

**Files moved:**
- `crypto.module.ts`
- `crypto.service.ts`

**Internal import update:**

| File | Before | After |
|------|--------|-------|
| `src/core/crypto/crypto.service.ts` | `'../core/validators/env'` | `'../validators/env'` |

**External import updates (8 files):**

| File | Before | After |
|------|--------|-------|
| `src/app.module.ts` | `'./crypto/crypto.module'` | `'./core/crypto/crypto.module'` |
| `src/app/smtp/smtp.module.ts` | `'../../crypto/crypto.module'` | `'../../core/crypto/crypto.module'` |
| `src/app/smtp/smtp-providers.service.ts` | `'../../crypto/crypto.service'` | `'../../core/crypto/crypto.service'` |
| `src/app/smtp/email-dispatcher.service.ts` | `'../../crypto/crypto.service'` | `'../../core/crypto/crypto.service'` |
| `src/app/auth/core/auth.service.ts` | `'../../../crypto/crypto.service'` | `'../../../core/crypto/crypto.service'` |
| `src/app/auth/two-factor/two-factor.service.ts` | `'../../../crypto/crypto.service'` | `'../../../core/crypto/crypto.service'` |
| `src/app/auth/strategies/jwt.strategy.ts` | `'../../../crypto/crypto.service'` | `'../../../core/crypto/crypto.service'` |
| `src/app/auth/strategies/jwt-partial.strategy.ts` | `'../../../crypto/crypto.service'` | `'../../../core/crypto/crypto.service'` |

### Step 3.7: Split `src/core/` into `src/common/` + `src/core/`

**Create directory:** `src/common/`

**Move to `src/common/` (7 subdirectories, 15 files):**

| Source | Destination |
|--------|-------------|
| `src/core/decorators/` | `src/common/decorators/` |
| `src/core/filters/` | `src/common/filters/` |
| `src/core/guards/` | `src/common/guards/` |
| `src/core/pipes/` | `src/common/pipes/` |
| `src/core/interceptors/` | `src/common/interceptors/` |
| `src/core/middlewares/` | `src/common/middlewares/` |
| `src/core/helpers/` | `src/common/helpers/` |

**Remain in `src/core/` (4 subdirectories):**
- `errors/` (domain-error.ts)
- `logging/` (app.logger.ts, route.logger.ts)
- `security-store/` (6 files)
- `validators/` (3 files)
- `database/` (moved in Step 3.1)
- `crypto/` (moved in Step 3.6)

**Move `src/@types/express.d.ts` → `src/common/@types/express.d.ts`:**

| File | Before | After |
|------|--------|-------|
| `src/common/@types/express.d.ts` | `'../core/database/types'` | `'../../core/database/types'` |

**Import updates in `src/main.ts` (6 changes):**

| Before | After |
|--------|-------|
| `'./core/filters/http-exception.filter'` | `'./common/filters/http-exception.filter'` |
| `'./core/interceptors/api-response.interceptor'` | `'./common/interceptors/api-response.interceptor'` |
| `'./core/middlewares/request-id.middleware'` | `'./common/middlewares/request-id.middleware'` |
| `'./core/middlewares/security-headers.middleware'` | `'./common/middlewares/security-headers.middleware'` |
| `'./core/logging/app.logger'` | No change (stays in core) |
| `'./core/logging/route.logger'` | No change (stays in core) |
| `'./core/validators/env'` | No change (stays in core) |

**Import updates in `src/app.module.ts` (2 changes):**

| Before | After |
|--------|-------|
| `'./core/guards/configurable-throttler.guard'` | `'./common/guards/configurable-throttler.guard'` |
| `'./core/pipes/zod-validation.pipe'` | `'./common/pipes/zod-validation.pipe'` |

**Import updates in feature controllers — decorators (5 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.controller.ts` | `'../../core/decorators/current-user.decorator'` | `'../../common/decorators/current-user.decorator'` |
| `src/app/users/users.controller.ts` | `'../../core/decorators/roles.decorator'` | `'../../common/decorators/roles.decorator'` |
| `src/app/media/media.controller.ts` | `'../../core/decorators/current-user.decorator'` | `'../../common/decorators/current-user.decorator'` |
| `src/app/smtp/smtp-providers.controller.ts` | `'../../core/decorators/current-user.decorator'` | `'../../common/decorators/current-user.decorator'` |
| `src/app/smtp/smtp-providers.controller.ts` | `'../../core/decorators/roles.decorator'` | `'../../common/decorators/roles.decorator'` |
| `src/app/system/system.controller.ts` | `'../../core/decorators/roles.decorator'` | `'../../common/decorators/roles.decorator'` |
| `src/app/email-logs/email-logs.controller.ts` | `'../../core/decorators/roles.decorator'` | `'../../common/decorators/roles.decorator'` |
| `src/app/email-template/email-template.controller.ts` | `'../../core/decorators/roles.decorator'` | `'../../common/decorators/roles.decorator'` |
| `src/app/auth/auth.controller.ts` | `'../../core/decorators/current-user.decorator'` | `'../../common/decorators/current-user.decorator'` |

**Import updates in feature controllers — guards (5 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.controller.ts` | `'../../core/guards/roles.guard'` | `'../../common/guards/roles.guard'` |
| `src/app/smtp/smtp-providers.controller.ts` | `'../../core/guards/roles.guard'` | `'../../common/guards/roles.guard'` |
| `src/app/system/system.controller.ts` | `'../../core/guards/roles.guard'` | `'../../common/guards/roles.guard'` |
| `src/app/email-logs/email-logs.controller.ts` | `'../../core/guards/roles.guard'` | `'../../common/guards/roles.guard'` |
| `src/app/email-template/email-template.controller.ts` | `'../../core/guards/roles.guard'` | `'../../common/guards/roles.guard'` |
| `src/app/auth/auth.controller.ts` | `'../../core/guards/brute-force.guard'` | `'../../common/guards/brute-force.guard'` |

**Import updates in feature controllers — interceptors (6 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.controller.ts` | `'../../core/interceptors/api-response.interceptor'` | `'../../common/interceptors/api-response.interceptor'` |
| `src/app/media/media.controller.ts` | `'../../core/interceptors/api-response.interceptor'` | `'../../common/interceptors/api-response.interceptor'` |
| `src/app/smtp/smtp-providers.controller.ts` | `'../../core/interceptors/api-response.interceptor'` | `'../../common/interceptors/api-response.interceptor'` |
| `src/app/system/system.controller.ts` | `'../../core/interceptors/api-response.interceptor'` | `'../../common/interceptors/api-response.interceptor'` |
| `src/app/email-logs/email-logs.controller.ts` | `'../../core/interceptors/api-response.interceptor'` | `'../../common/interceptors/api-response.interceptor'` |
| `src/app/email-template/email-template.controller.ts` | `'../../core/interceptors/api-response.interceptor'` | `'../../common/interceptors/api-response.interceptor'` |
| `src/app/auth/auth.controller.ts` | `'../../core/interceptors/api-response.interceptor'` | `'../../common/interceptors/api-response.interceptor'` |

**Import updates in feature controllers — pipes (6 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/users/users.controller.ts` | `'../../core/pipes/zod-validation.pipe'` | `'../../common/pipes/zod-validation.pipe'` |
| `src/app/media/media.controller.ts` | `'../../core/pipes/zod-validation.pipe'` | `'../../common/pipes/zod-validation.pipe'` |
| `src/app/smtp/smtp-providers.controller.ts` | `'../../core/pipes/zod-validation.pipe'` | `'../../common/pipes/zod-validation.pipe'` |
| `src/app/system/system.controller.ts` | `'../../core/pipes/zod-validation.pipe'` | `'../../common/pipes/zod-validation.pipe'` |
| `src/app/email-logs/email-logs.controller.ts` | `'../../core/pipes/zod-validation.pipe'` | `'../../common/pipes/zod-validation.pipe'` |
| `src/app/email-template/email-template.controller.ts` | `'../../core/pipes/zod-validation.pipe'` | `'../../common/pipes/zod-validation.pipe'` |
| `src/app/auth/auth.controller.ts` | `'../../core/pipes/zod-validation.pipe'` | `'../../common/pipes/zod-validation.pipe'` |

**Import updates — helpers (7 files):**

| File | Before | After |
|------|--------|-------|
| `src/app/auth/auth.controller.ts` | `'../../core/helpers/app.helper'` | `'../../common/helpers/app.helper'` |
| `src/app/csrf/csrf.service.ts` | `'../../core/helpers/app.helper'` | `'../../common/helpers/app.helper'` |
| `src/app/csrf/csrf.service.ts` | `'../../core/helpers/constant.helper'` | `'../../common/helpers/constant.helper'` |
| `src/app/auth/session/session.service.ts` | `'../../../core/helpers/constant.helper'` | `'../../../common/helpers/constant.helper'` |
| `src/app/auth/core/auth.service.ts` | `'../../../core/helpers/constant.helper'` | `'../../../common/helpers/constant.helper'` |
| `src/app/auth/services/magic-link-email.service.ts` | `'../../../core/helpers/constant.helper'` | `'../../../common/helpers/constant.helper'` |
| `src/app/auth/auth.module.ts` | `'../../core/helpers/constant.helper'` | `'../../common/helpers/constant.helper'` |
| `src/app/auth/strategies/jwt.strategy.ts` | `'../../../core/helpers/app.helper'` | `'../../../common/helpers/app.helper'` |
| `src/app/auth/strategies/jwt-partial.strategy.ts` | `'../../../core/helpers/app.helper'` | `'../../../common/helpers/app.helper'` |

**Internal cross-reference updates within moved `common/` files:**

Files that moved to `src/common/` and import from `src/core/` need path adjustments:

| File (new location) | Before | After |
|---------------------|--------|-------|
| `src/common/guards/configurable-throttler.guard.ts` | `'../../core/validators/env'` | `'../../core/validators/env'` (no change — same depth) |
| `src/common/guards/configurable-throttler.guard.ts` | `'../security-store'` | `'../../core/security-store'` |
| `src/common/guards/configurable-throttler.guard.ts` | `'../helpers/ip.helper'` | `'../helpers/ip.helper'` (no change — both in common) |
| `src/common/guards/brute-force.guard.ts` | `'../../core/validators/env'` | `'../../core/validators/env'` (no change) |
| `src/common/guards/brute-force.guard.ts` | `'../security-store'` | `'../../core/security-store'` |
| `src/common/guards/brute-force.guard.ts` | `'../errors/domain-error'` | `'../../core/errors/domain-error'` |
| `src/common/guards/brute-force.guard.ts` | `'../helpers/ip.helper'` | `'../helpers/ip.helper'` (no change) |
| `src/common/guards/roles.guard.ts` | `'../decorators/roles.decorator'` | `'../decorators/roles.decorator'` (no change — both in common) |
| `src/common/helpers/app.helper.ts` | `'../validators/env'` | `'../../core/validators/env'` |
| `src/common/filters/http-exception.filter.ts` | No internal core imports | No change |
| `src/common/interceptors/api-response.interceptor.ts` | No internal core imports | No change |
| `src/common/pipes/zod-validation.pipe.ts` | No internal core imports | No change |
| `src/common/middlewares/request-id.middleware.ts` | No internal core imports | No change |
| `src/common/middlewares/security-headers.middleware.ts` | No internal core imports | No change |

**Imports that stay pointing to `src/core/` (no change needed):**

These imports reference modules that remain in `src/core/` and do not need updating:
- All `'../../core/errors/domain-error'` imports (errors stays in core)
- All `'../../core/validators/*'` imports (validators stays in core)
- All `'../../core/security-store'` imports (security-store stays in core)
- All `'../../core/logging/*'` imports (logging stays in core)

### Step 3.8: Move `src/app.controller.ts` into Feature Module

**Create files:**

**`src/app/status/status.controller.ts`:**
```typescript
import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller()
export class StatusController {
	@Get()
	getRoot(@Res() res: Response): void {
		const html = `<!doctype html>...`;
		res.type('text/html').send(html);
	}
}
```

Copy the entire class body from `src/app.controller.ts`, renaming `AppController` to `StatusController`.

**`src/app/status/status.module.ts`:**
```typescript
import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';

@Module({
	controllers: [StatusController],
})
export class StatusModule {}
```

**Update `src/app.module.ts`:**

| Before | After |
|--------|-------|
| `import { AppController } from './app.controller';` | `import { StatusModule } from './app/status/status.module';` |
| `controllers: [AppController],` | Remove `controllers` array entirely |
| (imports array) | Add `StatusModule` to imports |

**Delete:** `src/app.controller.ts`

### Step 3.9: Quality Gate

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```

All three must pass. This is the highest-risk phase — if any import is missed, `tsc --noEmit` will catch it immediately.

---

## Phase 4: Repository Abstraction Layer

**Risk:** Medium
**Effort:** High (3–4 hours)
**Violations Resolved:** #3, #6

For each of the 10 concrete repositories, extract a public interface, create an interface file, update the concrete class to implement it, register the provider token, and update service injection.

### Step 4.1: Auth Repository Interface

**Create:** `src/app/auth/core/auth.repository.interface.ts`

**Extract public methods from `AuthRepository`:**
```typescript
import type { AccountSchemaType, UserSchemaType } from '../../../core/database/types';
import type { UpdateProfileDto } from '../schemas/auth.schema';
import type { AuthCreateUserData, AuthDbClient } from './auth.repository';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface IAuthRepository {
	transaction<T>(handler: (tx: AuthDbClient) => Promise<T>): Promise<T>;
	findUserById(id: number, db?: AuthDbClient): Promise<UserSchemaType | undefined>;
	findUserByPublicId(publicId: string, db?: AuthDbClient): Promise<UserSchemaType | undefined>;
	findUserByEmail(email: string, db?: AuthDbClient): Promise<UserSchemaType | undefined>;
	createUser(data: AuthCreateUserData, db?: AuthDbClient): Promise<UserSchemaType>;
	createMagicLinkUser(email: string, isApproved?: boolean, db?: AuthDbClient): Promise<UserSchemaType>;
	updateUser(userId: number, data: UpdateProfileDto & Pick<Partial<UserSchemaType>, 'imageInformation' | 'password'>, db?: AuthDbClient): Promise<UserSchemaType>;
	markUserEmailVerified(userId: number, db?: AuthDbClient): Promise<UserSchemaType | undefined>;
	removePassword(userId: number, db?: AuthDbClient): Promise<void>;
	findAccountByProvider(providerId: string, accountId: string, db?: AuthDbClient): Promise<AccountSchemaType | undefined>;
	createAccountLink(data: { accountId: string; providerId: string; userId: number }, db?: AuthDbClient): Promise<void>;
	deleteVerificationsByIdentifier(identifier: string, db?: AuthDbClient): Promise<void>;
	deleteVerificationByIdentifierValue(identifier: string, value: string, db?: AuthDbClient): Promise<void>;
	createVerification(data: { identifier: string; value: string; expiresAt: Date }, db?: AuthDbClient): Promise<void>;
	findVerification(identifier: string, value: string, db?: AuthDbClient): Promise<unknown>;
}
```

**Update `AuthRepository`:**
```typescript
export class AuthRepository implements IAuthRepository {
```

**Update `src/app/auth/auth.module.ts` providers:**
```typescript
{
	provide: AUTH_REPOSITORY,
	useClass: AuthRepository,
},
```

**Update `AuthService` constructor injection:**
```typescript
constructor(
	@Inject(AUTH_REPOSITORY)
	private readonly authRepository: IAuthRepository,
)
```

### Step 4.2: Session Repository Interface

**Create:** `src/app/auth/session/session.repository.interface.ts`

**Extract public methods:**
- `createSession(data: SessionDataType): Promise<SessionSchemaType>`
- `findSession(userId: number, sessionKeyOrId: string | number): Promise<SessionSchemaType | undefined>`
- `findSessionByPublicIdForUser(userId: number, publicId: string): Promise<SessionSchemaType | undefined>`
- `extendSession(sessionId: number, expiresAt: Date): Promise<SessionSchemaType | undefined>`
- `markTwoFactorVerified(sessionId: number): Promise<SessionSchemaType | undefined>`
- `updateTwoFactorFailureState(sessionId: number, data): Promise<SessionSchemaType | undefined>`
- `revokeSession(userId: number, sessionKeyOrId: string | number): Promise<void>`
- `revokeSessionByPublicIdForUser(userId: number, publicId: string): Promise<SessionSchemaType | undefined>`
- `revokeOtherActiveUserSessions(userId: number, currentSessionToken: string, now?: Date): Promise<number>`
- `revokeAllUserSessions(userId: number): Promise<number>`
- `listUserSessions(userId: number): Promise<SessionSchemaType[]>`
- `listUserSessionsPaginated(userId: number, query: SessionListQueryDto, currentSessionToken: string): Promise<{...}>`

**Token:** `SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY')`

**Update `SessionService` injection and `auth.module.ts` providers.**

### Step 4.3: Two-Factor Repository Interface

**Create:** `src/app/auth/two-factor/two-factor.repository.interface.ts`

**Extract public methods:**
- `transaction`, `findUserById`, `findSetupByUserId`, `replaceSetup`, `deleteSetupByUserId`, `enableTwoFactor`, `disableTwoFactor`, `replaceRecoveryCodes`, `deleteRecoveryCodesByUserId`, `findUnusedRecoveryCode`, `markRecoveryCodeUsed`, `countUnusedRecoveryCodes`

**Token:** `TWO_FACTOR_REPOSITORY = Symbol('TWO_FACTOR_REPOSITORY')`

### Step 4.4: Users Repository Interface

**Create:** `src/app/users/users.repository.interface.ts`

**Extract public methods:**
- `findUserByPublicId`, `findUserByEmail`, `listUsers`, `createUser`, `findUserManagementRowById`, `updateUser`, `updateUserRole`, `deleteUser`, `revokeAllUserSessions`

**Token:** `USERS_REPOSITORY = Symbol('USERS_REPOSITORY')`

### Step 4.5: Media Repository Interface

**Create:** `src/app/media/media.repository.interface.ts`

**Extract public methods:**
- `create`, `listByUserId`, `listByUserIdPaginated`, `findByPublicIdForUser`, `updateForUser`, `deleteForUser`, `countByUserId`

**Token:** `MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY')`

### Step 4.6: SMTP Providers Repository Interface

**Create:** `src/app/smtp/smtp-providers.repository.interface.ts`

**Extract public methods:**
- `findAll`, `findByPublicId`, `findDefaultActive`, `findAllActive`, `create`, `update`, `delete`, `clearAllDefaults`, `updateTestStatus`, `countActive`

**Token:** `SMTP_PROVIDERS_REPOSITORY = Symbol('SMTP_PROVIDERS_REPOSITORY')`

### Step 4.7: Audit Log Repository Interface

**Create:** `src/app/audit-log/audit-log.repository.interface.ts`

**Extract public methods:**
- `create`, `list`, `getDistinctActions`, `getDistinctTargetTypes`

**Token:** `AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY')`

### Step 4.8: Email Logs Repository Interface

**Create:** `src/app/email-logs/email-logs.repository.interface.ts`

**Extract public methods:**
- `create`, `findByProviderId`, `findAll`, `findByPublicId`, `findByPublicIdAndProviderId`, `deleteByPublicIdAndProviderId`

**Token:** `EMAIL_LOGS_REPOSITORY = Symbol('EMAIL_LOGS_REPOSITORY')`

### Step 4.9: Email Template Repository Interface

**Create:** `src/app/email-template/email-template.repository.interface.ts`

**Extract public methods:**
- `findActiveByKey`, `findAllActive`, `findAll`, `findByPublicId`, `findById`, `create`, `deactivateByKeyAndVersion`

**Token:** `EMAIL_TEMPLATE_REPOSITORY = Symbol('EMAIL_TEMPLATE_REPOSITORY')`

### Step 4.10: System Repository Interface

**Create:** `src/app/system/system.repository.interface.ts`

**Extract public methods:**
- `initializeSchema`, `getSettings`, `createSettings`, `updateSettings`

**Token:** `SYSTEM_REPOSITORY = Symbol('SYSTEM_REPOSITORY')`

### Step 4.11: Refactor `postgres-store.service.ts`

**File:** `src/core/security-store/postgres-store.service.ts`

This service directly injects `DATABASE_CONNECTION` and executes Drizzle queries. Since it is itself a data access layer (implementing `ISecurityStore`), reclassify it as a repository-style service. The `DATABASE_CONNECTION` injection is acceptable here because `PostgresSecurityStore` functions as the repository itself — it is the data access boundary.

**Alternative approach:** Create a `SecurityCacheRepository` that wraps all `securityCache` table operations, inject it into `PostgresSecurityStore`, and have `PostgresSecurityStore` delegate table operations to it.

**Recommended approach:** Since `PostgresSecurityStore` already implements `ISecurityStore` (an interface) and is provided via the `SECURITY_STORE_TOKEN`, it already follows the repository pattern in spirit. Document this as an intentional deviation: the security store IS the repository for security cache data. No code change required — add a comment documenting the architectural decision.

### Step 4.12: Update All Module Provider Registrations

For each feature module, update the `providers` array to register the interface token:

**Pattern:**
```typescript
providers: [
	{
		provide: USERS_REPOSITORY,
		useClass: UsersRepository,
	},
	UsersService,
],
```

**Update all service constructors** to inject via `@Inject(TOKEN)` with the interface type instead of the concrete class.

### Step 4.13: Quality Gate

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```

---

## Phase 5: Response Validation with Zod

**Risk:** Medium
**Effort:** High (2–3 hours)
**Violations Resolved:** #4

### Step 5.1: Define Response Schemas

For each endpoint, create a corresponding response schema in the same schema file as the input schema.

**Pattern:**
```typescript
export const UserResponseSchema = z.object({
	publicId: z.string(),
	name: z.string().nullable(),
	email: z.string().email(),
	role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;
```

### Step 5.2: Add `.parse()` to Every Controller Method

**Before:**
```typescript
@Get(':id')
async findOne(@Param('id') id: string) {
	const user = await this.usersService.findById(id);
	return createApiResponse(200, 'User found', user);
}
```

**After:**
```typescript
@Get(':id')
async findOne(@Param('id') id: string) {
	const user = await this.usersService.findById(id);
	return createApiResponse(200, 'User found', UserResponseSchema.parse(user));
}
```

### Step 5.3: Affected Controllers (10 files)

| Controller | Estimated Endpoints |
|------------|-------------------|
| `src/app/auth/auth.controller.ts` | ~15 endpoints |
| `src/app/users/users.controller.ts` | ~5 endpoints |
| `src/app/media/media.controller.ts` | ~5 endpoints |
| `src/app/smtp/smtp-providers.controller.ts` | ~6 endpoints |
| `src/app/audit-log/audit-log.controller.ts` | ~3 endpoints |
| `src/app/email-logs/email-logs.controller.ts` | ~3 endpoints |
| `src/app/email-template/email-template.controller.ts` | ~4 endpoints |
| `src/app/system/system.controller.ts` | ~2 endpoints |
| `src/app/csrf/csrf.controller.ts` | ~1 endpoint |
| `src/app/health/health.controller.ts` | ~1 endpoint |

### Step 5.4: Quality Gate

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```

---

## Phase 6: Policy Layer & Auth Schema Consolidation

**Risk:** Medium
**Effort:** High (2–3 hours)
**Violations Resolved:** #8, #9, #15

### Step 6.1: Create Policy Files for Modules That Lack Them

**Create these 5 policy files:**

| File | Module | Authorization Rules |
|------|--------|-------------------|
| `src/app/audit-log/audit-log.policy.ts` | Audit Log | ADMIN-only access |
| `src/app/email-logs/email-logs.policy.ts` | Email Logs | ADMIN-only access |
| `src/app/email-template/email-template.policy.ts` | Email Template | ADMIN-only access |
| `src/app/system/system.policy.ts` | System | ADMIN-only access |
| `src/app/auth/auth.policy.ts` | Auth | Mixed: public endpoints + authenticated + ADMIN |

**Policy file pattern:**
```typescript
import { forbiddenError } from '../../core/errors/domain-error';
import type { UserWithoutPassword } from '../auth/core/auth.types';

export const AuditLogPolicy = {
	canList(user: UserWithoutPassword): void {
		if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
			throw forbiddenError('forbidden', 'Only administrators can view audit logs');
		}
	},
};
```

### Step 6.2: Move Auth Schema Files into `src/app/auth/schemas/`

**Create directory:** `src/app/auth/schemas/`

**Move 4 files:**

| Source | Destination |
|--------|-------------|
| `src/app/auth/core/auth.schema.ts` | `src/app/auth/schemas/auth.schema.ts` |
| `src/app/auth/core/password.schema.ts` | `src/app/auth/schemas/password.schema.ts` |
| `src/app/auth/session/session.schema.ts` | `src/app/auth/schemas/session.schema.ts` |
| `src/app/auth/two-factor/two-factor.schema.ts` | `src/app/auth/schemas/two-factor.schema.ts` |

**Import updates for moved schema files (internal imports to `core/validators/`):**

| File | Before | After |
|------|--------|-------|
| `src/app/auth/schemas/auth.schema.ts` | `'../../../core/validators/common.schema'` | `'../../../core/validators/common.schema'` (no change — same depth) |
| `src/app/auth/schemas/password.schema.ts` | `'../../../core/validators/common.schema'` | `'../../../core/validators/common.schema'` (no change) |
| `src/app/auth/schemas/session.schema.ts` | `'../../../core/validators/common.schema'` | `'../../../core/validators/common.schema'` (no change) |
| `src/app/auth/schemas/session.schema.ts` | `'../../../core/validators/base-query.schema'` | `'../../../core/validators/base-query.schema'` (no change) |
| `src/app/auth/schemas/two-factor.schema.ts` | `'../../../core/validators/common.schema'` | `'../../../core/validators/common.schema'` (no change) |

**Import updates for consumers of moved schema files:**

| File | Before | After |
|------|--------|-------|
| `src/app/auth/auth.controller.ts` | `'./core/auth.schema'` | `'./schemas/auth.schema'` |
| `src/app/auth/auth.controller.ts` | `'./core/password.schema'` | `'./schemas/password.schema'` |
| `src/app/auth/core/auth.repository.ts` | `'./auth.schema'` | `'../schemas/auth.schema'` |
| `src/app/auth/session/session.service.ts` | `'./session.schema'` | `'../schemas/session.schema'` |
| `src/app/auth/session/session.repository.ts` | `'./session.schema'` | `'../schemas/session.schema'` |
| `src/app/auth/two-factor/two-factor.service.ts` | `'./two-factor.schema'` | `'../schemas/two-factor.schema'` |

### Step 6.3: Quality Gate

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```

---

## Phase 7: Email Templates & Documentation

**Risk:** Low
**Effort:** Medium (2–3 hours, may require product decision)
**Violations Resolved:** #10, #30

### Step 7.1: Evaluate Handlebars vs Code-First Approach

**File:** `src/app/email-template/email-template.mapper.ts`

**Current state:** Templates stored in database as Handlebars strings, compiled at runtime.

**Decision required:**
- If DB-stored templates are a product requirement (user-editable via admin panel), document this as an intentional architectural deviation and add type-safe context validation around Handlebars render calls.
- If templates can be code-first, replace Handlebars with TypeScript template literal classes in `src/app/[feature]/emails/`.

**If keeping Handlebars (pragmatic path):**
1. Add a typed context validator per template key.
2. Document the deviation in `docs/planning/email-template-deviation.md`.

**If going code-first (full compliance):**
1. Create `src/app/auth/emails/` directory.
2. Create template classes for each email type: `welcome.email.ts`, `magic-link.email.ts`, `invitation.email.ts`, `two-factor-alert.email.ts`, `approval.email.ts`.
3. Each class uses TypeScript template literals.
4. Remove `handlebars` dependency from `package.json`.
5. Update `email-dispatcher.service.ts` and all email service files.

### Step 7.2: Audit API Documentation Completeness

**Files to audit (8 files):**

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

**Required sections per doc (11 sections):**
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

**Missing modules (need new docs):**
- `docs/api/email-logs.md` — Email Logs module has no API doc
- `docs/api/email-template.md` — Email Template module has no API doc

### Step 7.3: Quality Gate

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```

---

## Dependency Graph

```
Phase 1 (30 min)
  │
  ▼
Phase 2 (1–2 hrs)
  │
  ▼
Phase 3 (3–4 hrs) ──── atomic commit required
  │
  ├──→ Phase 4 (3–4 hrs) ─┐
  ├──→ Phase 5 (2–3 hrs) ─┤── can run in parallel
  └──→ Phase 6 (2–3 hrs) ─┘
                            │
                            ▼
                       Phase 7 (2–3 hrs)
```

**Parallel execution notes:**
- Phases 4, 5, and 6 touch different files and can be developed in parallel branches.
- Phase 4 touches: `*.repository.interface.ts` (new), `*.repository.ts`, `*.service.ts`, `*.module.ts`
- Phase 5 touches: `*.schema.ts` (response schemas), `*.controller.ts`
- Phase 6 touches: `*.policy.ts` (new), `*.controller.ts`, `auth/schemas/` (moves)
- **Conflict warning:** Phases 5 and 6 both modify controller files. Merge Phase 5 first, then rebase Phase 6.

---

## Risk Assessment

### What Could Break

| Risk | Phase | Likelihood | Impact | Mitigation |
|------|-------|------------|--------|------------|
| Missed import path during bulk move | 3 | High | Build failure | `pnpm tsc --noEmit` catches all broken imports immediately |
| Circular dependency after common/core split | 3 | Medium | Runtime failure | Guards import from `core/security-store` — verify no reverse dependency |
| Repository interface breaks DI container | 4 | Medium | Runtime failure | Test each module individually after registration |
| Response `.parse()` rejects valid data | 5 | Medium | 500 errors | Define response schemas to match actual service return types exactly |
| `update-schema.mjs` breaks after rename | 3 | Low | Pre-build hook failure | Test `pnpm prebuild` immediately after Step 3.4 |
| `drizzle-kit` commands fail | 3 | Low | Migration failure | Test `pnpm db:push` after Step 3.3 |

### Rollback Strategy

Each phase is a single merge commit. If a phase causes issues:
1. `git revert <merge-commit>` to undo the entire phase.
2. Fix the issue in a new branch.
3. Re-submit the corrected phase.

Phase 3 is the highest risk. If it fails:
1. Revert immediately.
2. Split Phase 3 into smaller atomic commits (3.1+3.2+3.3+3.4+3.5 as one, 3.6 as another, 3.7 as another, 3.8 as another).

---

## Post-Fix Verification Checklist

After all 7 phases are complete, verify:

- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm build` completes successfully
- [x] `src/models/` directory no longer exists — ✅ Phase 3
- [x] `src/database/` directory no longer exists — ✅ Phase 3
- [x] `src/crypto/` directory no longer exists at root level — ✅ Phase 3
- [x] `src/@types/` directory no longer exists at root level — ✅ Phase 3
- [x] `src/app.controller.ts` no longer exists at root level — ✅ Phase 3
- [x] `src/common/` exists with decorators, filters, guards, pipes, interceptors, middlewares, helpers — ✅ Phase 3
- [x] `src/core/` contains only: crypto, database, errors, logging, security-store, validators — ✅ Phase 3
- [x] `src/core/database/schema/` contains all 10 `*.schema.ts` files — ✅ Phase 3
- [x] `drizzle.config.ts` points to `./src/core/database/schema` — ✅ Phase 3
- [x] `update-schema.mjs` points to correct paths and file extensions — ✅ Phase 3
- [x] `package.json` scripts reference `src/core/database/` paths — ✅ Phase 3
- [ ] Every `*.repository.ts` has a corresponding `*.repository.interface.ts`
- [ ] Every controller method ends with `ResponseSchema.parse(data)`
- [ ] Every feature module with authorization logic has a `*.policy.ts` file
- [x] No single-file subfolders exist in any feature module — ✅ Phase 2 + Phase 3 (`src/@types/` moved to `src/common/@types/`)
- [x] No empty directories exist in `src/app/auth/` — ✅ Phase 1
- [x] No commented-out dead code exists in `clean.ts` or `common.schema.ts` — ✅ Phase 1
- [x] No `npm run` references exist anywhere in the codebase — ✅ Phase 1
- [ ] All `docs/api/*.md` files contain all 11 required sections
- [ ] `docs/api/email-logs.md` and `docs/api/email-template.md` exist
