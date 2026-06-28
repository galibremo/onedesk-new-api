# Users Management

## Goal

Add an admin-only users management module for listing user accounts, creating managed accounts,
updating user profile/access fields, updating roles, deleting users, and revoking a target user's
sessions from the dashboard.

## Decisions

- Implement the backend as `src/app/users` to match the project app-module convention.
- Use the existing `users` and `sessions` tables; no schema migration is required.
- Expose public UUIDs as `id` in API responses and keep internal numeric IDs server-side only.
- Restrict the module with `JwtAuthGuard`, `RolesGuard`, and `@Roles('ADMIN')`.
- Apply conservative management rules in service policy code:
  - `SUPER_ADMIN` can manage all non-self users.
  - `ADMIN` can manage only `USER` and `MANAGER` users.
  - No user can create or update roles outside their assignable hierarchy.
  - No user can manage their own account through this module.
- User deletion is in scope for the management module and relies on existing cascade/set-null
  database relationships.

## API Surface

- `GET /users`: list users with search, filters, sorting, and pagination.
- `POST /users`: create a managed user account.
- `PATCH /users/:id`: update account fields such as name, email, phone, verification, and 2FA flag.
- `PATCH /users/:id/role`: update a target user's role.
- `DELETE /users/:id`: delete a target user.
- `POST /users/:id/sessions/revoke`: revoke a target user's non-revoked sessions.

## Dashboard Surface

- Add `/users` to the dashboard route group and Platform navigation.
- Reuse the existing table, filter, dialog, select, alert, badge, avatar, and button components.
- Keep filters in URL state with `nuqs` and server state in TanStack Query.
- Provide create, edit, role-change, session-revoke, and delete actions wherever the current admin
  can manage the target user.
