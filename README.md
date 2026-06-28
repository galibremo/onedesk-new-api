# Boilerplate API

`boilerplate-api` is the primary NestJS backend in this workspace. It provides authentication, media
management, CSRF-protected mutating endpoints, and a consistent API surface used by frontends and
integrations.

## Overview

- Auth: magic-link sign-in, Google login, session management, and profile endpoints (`/auth`).
- Media: upload, list, update, and delete media assets (`/media`).
- CSRF: token issuing and unsafe-method protection (`/csrf`).
- Security: JWT guards, CSRF guard, and standardized error responses.

## Tech Stack

- NestJS 11
- TypeScript
- Drizzle ORM + PostgreSQL
- Zod for environment and request validation

## Modules

- `auth` — Authentication, magic-links, Google login, sessions, and 2FA (several endpoints, ~17
  handlers).
- `csrf` — CSRF token issuance (1 handler).
- `media` — Media upload, listing, update, delete (4 handlers).
- `users` — Admin user management and session controls (7 handlers).

Summary: 4 public API modules and approximately 29 route handlers across the controllers under
`src/app/`.

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables (see `src/core/validators/env.ts`).

3. Start the API in development mode:

```bash
pnpm run dev
```

## Useful Scripts

```bash
# Build
pnpm run build

# Start modes
pnpm run start
pnpm run dev
pnpm run debug
pnpm run prod

# Database
pnpm run db:generate
pnpm run db:migrate
pnpm run db:push
pnpm run db:studio

# Lint
pnpm run lint
```

## Routes and Documentation

- Public status page: `/` (simple HTML status and quick links).
- CSRF token: `/csrf` (issues CSRF cookie + response token).
- Current user: `/auth/me` (requires JWT).
- Media endpoints: `/media` (JWT + CSRF for mutating requests).

The status page served at `/` is implemented in `src/app.controller.ts` and intentionally links to
module documentation under `docs/api/`. When adding or removing controllers, regenerate
`routes.json` so the route inventory stays accurate.

Use controllers and `docs/api/` as the source of truth for API contracts. `routes.json` is a
generated route inventory when the app is able to regenerate it.

Canonical module-wise API documentation is stored under `docs/api/`; update the matching module doc
when you add or modify endpoints.

## Contributing

- Follow existing module boundaries in `src/app/*`.
- Add or update docs in `docs/api/` when changing public API contracts.

## Notes

- Global response formatting and exception handling are configured in `src/main.ts`.
- The index route at `/` serves an HTML status page implemented in `src/app.controller.ts`.
# onedesk-new-api
# onedesk-new-api
