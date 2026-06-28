# API Boilerplate — Phase 1 Focused Implementation Plan

## Goal

Implement the 5 selected gaps (GAP-04, GAP-05, GAP-06, GAP-08, GAP-09) to add activity auditing,
administrative APIs, complete transactional emails, cached settings performance, and structured
logging. Password authentication changes are explicitly excluded.

---

## Open Questions

> [!IMPORTANT] **Structured logging library**: We recommend **Pino** for low overhead and
> JSON-native logs, which integrates nicely with `pino-http` middleware and prints beautifully in
> development using `pino-pretty`. Do you approve of using Pino, or do you have a preference for
> another library (e.g., Winston)?
>
> **Audit log actor for system-initiated actions**: For events like auto-approving a user when
> settings access model is `OPEN`, the event is system-initiated. Should the actor in the audit log
> represent a null/system actor, or should we omit logging system-initiated actions and only log
> user-initiated actions?
>
> **2FA alert emails**: Should 2FA security alerts be sent both when a user disables 2FA themselves
> via the dashboard, and when an administrator resets it using the admin panel?

---

## Proposed Changes

### GAP-05 — Missing `GET /users/:id` Admin Endpoint

#### [MODIFY] [users.service.ts](file:///f:/boilerplate/api/src/app/users/users.service.ts)

- Add a new method [getUserById](file:///f:/boilerplate/api/src/app/users/users.service.ts):
  ```typescript
  async getUserById(currentUser: UserWithoutPassword, publicId: string): Promise<UserManagementResponse> {
      const targetUser = await this.getTargetUser(publicId);
      UsersPolicy.assertCanManageUser(currentUser, targetUser);
      return this.getManagementResponse(targetUser.id);
  }
  ```

#### [MODIFY] [users.controller.ts](file:///f:/boilerplate/api/src/app/users/users.controller.ts)

- Add a route handler for `GET /users/:id`, using the standard decorators:
  ```typescript
  @Get(':id')
  async getUser(
      @CurrentUser() currentUser: UserWithoutPassword,
      @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<UserManagementResponse>> {
      const user = await this.usersService.getUserById(currentUser, id);
      return createApiResponse(HttpStatus.OK, 'User fetched successfully', user);
  }
  ```

---

### GAP-08 — No System Settings Cache

#### [MODIFY] [system.service.ts](file:///f:/boilerplate/api/src/app/system/system.service.ts)

- Introduce in-memory cache fields:
  ```typescript
  private cachedSettings: SystemSettingsSchemaType | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds
  ```
- Modify [getSettings](file:///f:/boilerplate/api/src/app/system/system.service.ts):
  - If `cachedSettings` is not null and `Date.now() < cacheExpiresAt`, return `cachedSettings`.
  - Otherwise, query from the database, cache it, update `cacheExpiresAt`, and return it.
- Modify [updateSettings](file:///f:/boilerplate/api/src/app/system/system.service.ts):
  - Invalidate the cache by setting `cachedSettings = null` and `cacheExpiresAt = 0`.

---

### GAP-09 — No Structured / JSON Logging

#### [MODIFY] [package.json](file:///f:/boilerplate/api/package.json)

- Add `pino`, `pino-http`, and `pino-pretty` to dependencies.
- Add `@types/pino` to devDependencies.

#### [NEW] [app.logger.ts](file:///f:/boilerplate/api/src/core/logging/app.logger.ts)

- Completely replace [app.logger.ts](file:///f:/boilerplate/api/src/core/logging/app.logger.ts) to
  utilize `pino` and `pino-http`:
  - Set up a logger configuration that outputs JSON format in production and pretty-printed logs in
    development mode.
  - Automatically serialize: `requestId`, `userId` (from `req.user?.id`), `method`, `url`,
    `statusCode`, and `responseTime`.
  - Redact sensitive headers: `req.headers.authorization` and `req.headers.cookie`.

#### [MODIFY] [main.ts](file:///f:/boilerplate/api/src/main.ts)

- Replace [appLogger](file:///f:/boilerplate/api/src/core/logging/app.logger.ts) middleware
  integration with the new Pino HTTP middleware setup.

---

### GAP-04 — No Audit / Activity Log

#### [NEW] [audit-log.model.ts](file:///f:/boilerplate/api/src/models/drizzle/audit-log.model.ts)

- Define the Drizzle table schema for audit log entries:
  - `id`: serial PK
  - `publicId`: uuid unique (default random)
  - `actorId`: integer FK to `users.id` (nullable for system-initiated actions)
  - `actorRole`: `roleTypeEnum`
  - `action`: varchar(100) (e.g. `USER_CREATED`, `ROLE_UPDATED`, `2FA_DISABLED`)
  - `targetType`: varchar(50) (e.g. `user`, `session`)
  - `targetId`: varchar(100) (public ID of target resource)
  - `metadata`: jsonb (stores change diffs or details)
  - `ipAddress`: text
  - `userAgent`: text
  - timestamps (createdAt, updatedAt)
  - Create index on `actorId`, `action`, `targetId`, and `createdAt`.

#### [MODIFY] [relation.model.ts](file:///f:/boilerplate/api/src/models/drizzle/relation.model.ts)

- Add relations for [auditLogs](file:///f:/boilerplate/api/src/models/drizzle/relation.model.ts)
  linking them to the [users](file:///f:/boilerplate/api/src/models/drizzle/auth.model.ts) table.

#### [NEW] [audit-log.module.ts](file:///f:/boilerplate/api/src/app/audit-log/audit-log.module.ts)

- Standard module defining dependencies.

#### [NEW] [audit-log.repository.ts](file:///f:/boilerplate/api/src/app/audit-log/audit-log.repository.ts)

- Add operations to insert logs and fetch logs.

#### [NEW] [audit-log.service.ts](file:///f:/boilerplate/api/src/app/audit-log/audit-log.service.ts)

- Expose a `logAction(...)` method: captures action details, context, and inserts it.

#### [NEW] [audit-log.controller.ts](file:///f:/boilerplate/api/src/app/audit-log/audit-log.controller.ts)

- Expose a `GET /audit-logs` endpoint:
  - Accessible only to admins (`@Roles('ADMIN')`).
  - Supports pagination (`page`, `pageSize`) and filters (`actorId`, `action`, `targetType`).

#### [MODIFY] [app.module.ts](file:///f:/boilerplate/api/src/app.module.ts)

- Register [AuditLogModule](file:///f:/boilerplate/api/src/app/audit-log/audit-log.module.ts).

#### [MODIFY] [users.service.ts](file:///f:/boilerplate/api/src/app/users/users.service.ts)

- Inject [AuditLogService](file:///f:/boilerplate/api/src/app/audit-log/audit-log.service.ts).
- Write log entries in [createUser](file:///f:/boilerplate/api/src/app/users/users.service.ts),
  [updateUser](file:///f:/boilerplate/api/src/app/users/users.service.ts),
  [updateUserRole](file:///f:/boilerplate/api/src/app/users/users.service.ts),
  [deleteUser](file:///f:/boilerplate/api/src/app/users/users.service.ts),
  [revokeUserSessions](file:///f:/boilerplate/api/src/app/users/users.service.ts), and
  [resetUserTwoFactor](file:///f:/boilerplate/api/src/app/users/users.service.ts).

#### [MODIFY] [auth.controller.ts](file:///f:/boilerplate/api/src/app/auth/auth.controller.ts)

- Inject [AuditLogService](file:///f:/boilerplate/api/src/app/audit-log/audit-log.service.ts).
- Write log entries in
  [disableTwoFactor](file:///f:/boilerplate/api/src/app/auth/auth.controller.ts) and
  [verifyMagicLink](file:///f:/boilerplate/api/src/app/auth/auth.controller.ts) (login success).

---

### GAP-06 — Transactional Email Templates Are Incomplete

#### [MODIFY] [email-template.seed.ts](file:///f:/boilerplate/api/src/database/seeds/email-template.seed.ts)

- Add new seeds for missing transactional email templates:
  - Welcome email template (`auth_welcome`): Sent on registration.
  - Account approval email template (`auth_account_approval`): Sent when admin approves a pending
    user.
  - Invitation email template (`auth_invitation`): Sent when an admin creates a user account.
  - 2FA security alert template (`auth_two_factor_alert`): Sent when 2FA is enabled or disabled.

#### [NEW] [welcome-email.service.ts](file:///f:/boilerplate/api/src/app/auth/services/welcome-email.service.ts)

- Inject `EmailDispatcherService` to send using template `auth_welcome`.

#### [NEW] [approval-email.service.ts](file:///f:/boilerplate/api/src/app/auth/services/approval-email.service.ts)

- Inject `EmailDispatcherService` to send using template `auth_account_approval`.

#### [NEW] [invitation-email.service.ts](file:///f:/boilerplate/api/src/app/auth/services/invitation-email.service.ts)

- Inject `EmailDispatcherService` to send using template `auth_invitation`.

#### [NEW] [two-factor-alert-email.service.ts](file:///f:/boilerplate/api/src/app/auth/services/two-factor-alert-email.service.ts)

- Inject `EmailDispatcherService` to send using template `auth_two_factor_alert`.

#### [MODIFY] [auth.module.ts](file:///f:/boilerplate/api/src/app/auth/auth.module.ts)

- Register the new email services as providers.

#### [MODIFY] [auth.service.ts](file:///f:/boilerplate/api/src/app/auth/core/auth.service.ts)

- Inject
  [WelcomeEmailService](file:///f:/boilerplate/api/src/app/auth/services/welcome-email.service.ts).
- Trigger welcome email during first-time user provisioning in
  [findOrProvisionMagicLinkUser](file:///f:/boilerplate/api/src/app/auth/core/auth.service.ts) and
  [findOrCreateGoogleUser](file:///f:/boilerplate/api/src/app/auth/core/auth.service.ts).

#### [MODIFY] [users.service.ts](file:///f:/boilerplate/api/src/app/users/users.service.ts)

- Inject
  [InvitationEmailService](file:///f:/boilerplate/api/src/app/auth/services/invitation-email.service.ts)
  and
  [ApprovalEmailService](file:///f:/boilerplate/api/src/app/auth/services/approval-email.service.ts).
- Trigger invitation email in
  [createUser](file:///f:/boilerplate/api/src/app/users/users.service.ts).
- Trigger approval email in [updateUser](file:///f:/boilerplate/api/src/app/users/users.service.ts)
  if `isApproved` changes to `true`.

#### [MODIFY] [auth.controller.ts](file:///f:/boilerplate/api/src/app/auth/auth.controller.ts)

- Inject
  [TwoFactorAlertEmailService](file:///f:/boilerplate/api/src/app/auth/services/two-factor-alert-email.service.ts).
- Trigger alert email when disabling 2FA in
  [disableTwoFactor](file:///f:/boilerplate/api/src/app/auth/auth.controller.ts).

---

## Verification Plan

### Automated Checks

```bash
# Verify the code compiles correctly
pnpm build

# Verify syntax style and lint checks
pnpm lint

# Ensure dev server launches without runtime errors
pnpm dev

# Check database schemas match migrations
pnpm db:push
```

### Manual Verification

1. **Fetch User** — Execute `GET /users/:id` using an admin account session, confirming details are
   returned correctly.
2. **Settings Cache** — Call `GET /system/settings` and inspect console/database query logs to
   verify subsequent rapid requests do not query the DB.
3. **Structured Logs** — View the backend log output: check JSON formatted logs in production-like
   builds, and pretty-printed logs in dev.
4. **Audit Logs** — Perform actions (e.g. login, update role) and execute `GET /audit-logs` to
   verify history entries.
5. **Transactional Emails** — Verify email sending logs or mail traps for Welcome, Invite, Approval,
   and 2FA changes.

---

## Implementation Order

```
Step 1: Single User Fetch Route (GAP-05)
Step 2: Settings Cache (GAP-08)
Step 3: Structured Logging (GAP-09)
Step 4: Audit Logs Module (GAP-04)
Step 5: Emails Wiring (GAP-06)
```
