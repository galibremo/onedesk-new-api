# CSRF API

The CSRF module exposes the token endpoint and provides the global guard used by unsafe methods.

## Get CSRF Token

`GET /csrf`

### Purpose

Issues a CSRF token for browser clients.

### How It Works

The service generates a double-submit CSRF token, sets the `csrf-token` HTTP-only cookie, and
returns the token in the standard API response envelope. Clients must keep the cookie and send the
returned token in the `x-csrf-token` header on unsafe requests.

### Authentication

None.

### CSRF

Not required because this is a safe `GET` route.

### Required Parameters

None.

### Optional Parameters

None.

### Validation Rules

None.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Success",
	"data": "csrf-token-value",
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/csrf"
}
```

### Error Responses

The token endpoint has no expected domain-level validation errors. Unsafe requests that do not send
the issued token and matching cookie fail with `403 csrf_invalid`.

### Example Error Response

```json
{
	"statusCode": 403,
	"code": "csrf_invalid",
	"error": "Forbidden",
	"message": "Invalid CSRF token. Perhaps your browser blocked 3rd-party cookies. Please allow 3rd-party cookies or try a different browser. If the problem persists, please contact support.",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media",
	"requestId": "req_123"
}
```

## Guard Behavior

Unsafe methods (`POST`, `PUT`, `PATCH`, and `DELETE`) require:

- The `csrf-token` cookie from `GET /csrf`.
- The same token value in the `x-csrf-token` request header.

Safe methods (`GET`, `HEAD`, and `OPTIONS`) bypass CSRF validation.
