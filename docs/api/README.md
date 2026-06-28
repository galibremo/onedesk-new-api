# API Documentation

This folder is the canonical module-wise API documentation for app modules that expose HTTP
routes. The docs are written from the current controllers, schemas, pipes, services, and policies,
not from `routes.json`.

## Modules

- [Audit Logs](audit-logs.md): admin activity history for sensitive account and access events.
- [Auth](auth.md): magic links, Google login, logout, session management, and profile routes.
- [CSRF](csrf.md): CSRF token issuing and unsafe-method protection.
- [Health](health.md): database connectivity and memory usage health checks.
- [Media](media.md): media upload, listing, update, and deletion routes.
- [System](system.md): application-level access model and role configuration.
- [Users](users.md): admin user directory, user CRUD, role updates, and session revocation.

`template` is an internal app module and does not expose public API routes.

## Success Envelope

Most JSON endpoints are wrapped by the global API response interceptor:

```json
{
	"statusCode": 200,
	"message": "Success message",
	"data": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/example"
}
```

Redirect endpoints that use an Express response object can return a redirect instead of this JSON
shape.

## Error Envelope

HTTP exceptions are formatted by the global exception filter:

```json
{
	"statusCode": 422,
	"code": "validation_failed",
	"error": "Unprocessable Entity",
	"message": "Email is invalid",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/example",
	"requestId": "req_123"
}
```

Domain and boundary failures should use the project error helpers in
`src/core/errors/domain-error.ts` unless a standard NestJS exception is more appropriate.

## Authentication

Authenticated routes use the `access-token` HTTP-only cookie. The cookie is issued by successful
magic-link verification and Google login, and it is cleared by logout.

## CSRF

Unsafe methods (`POST`, `PUT`, `PATCH`, and `DELETE`) are protected by the global CSRF guard.
Clients should first call `GET /csrf`, preserve the returned `csrf-token` cookie, and send the
returned token in the `x-csrf-token` header on unsafe requests.

Safe methods (`GET`, `HEAD`, and `OPTIONS`) do not require the CSRF header.

## Multipart Uploads

Auth profile image upload uses the `avatar` field. Media upload uses the `file` field.

Allowed file types are `image/png`, `image/jpeg`, and `image/webp`. The maximum file size is
2 MB.
