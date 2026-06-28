# Auth API

Auth routes live under `/auth`. Successful login-style routes set an `access-token` HTTP-only cookie
that is later read by the JWT strategy.

Unsafe methods require CSRF protection unless explicitly stated otherwise. Call `GET /csrf` first,
keep the `csrf-token` cookie, and send the returned token as `x-csrf-token`.

User response examples use `id` as the public user UUID.

## Request Magic Link

`POST /auth/magic-link/request`

### Purpose

Sends a one-time sign-in link to the supplied email address.

### How It Works

The email is normalized, an existing verification token for that email is removed, a new hashed
token is stored, and the raw token is sent by email in a frontend verification link:
`${APP_URL}/auth/magic-link/verify?email=user@example.com&token=token-value`. If a safe same-origin
`redirectUrl` is provided, the verification link also includes it as a `redirect` query parameter.
The response is intentionally generic.

### Authentication

None.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

JSON body:

```json
{
	"email": "user@example.com",
	"redirectUrl": "http://localhost:3030/users"
}
```

### Optional Parameters

- `redirectUrl`: optional same-origin frontend URL to visit after successful verification.

### Validation Rules

- `email` must be a valid email address.
- `redirectUrl`, when present, must be a string. Unsafe cross-origin values are ignored when
  building the email link.
- Unknown body fields are rejected.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "If the email exists, a magic link has been sent",
	"data": null,
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/magic-link/request"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `422 validation_failed` when the request body fails validation.
- `502 magic_link_email_failed` when the email provider fails.

### Example Error Response

```json
{
	"statusCode": 422,
	"code": "validation_failed",
	"error": "Unprocessable Entity",
	"message": "Email is invalid",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/magic-link/request",
	"requestId": "req_123"
}
```

## Verify Magic Link With Redirect

`GET /auth/magic-link/verify?email=user@example.com&token=token-value&redirect=http%3A%2F%2Flocalhost%3A3030%2Fusers`

### Purpose

Verifies a one-time magic-link token directly through the API and redirects afterward. This route is
kept as a browser fallback; the primary frontend flow uses the JSON verification route below.

### How It Works

The token is hashed and matched against the stored verification. If valid and unexpired, the user is
created or marked verified as needed, the verification token is removed, dashboard access is checked,
a session token is created, and the `access-token` cookie is set before redirecting to the frontend
success page.

### Authentication

None.

### CSRF

Not required because this is a safe `GET` route.

### Required Parameters

Query parameters:

- `email`: email address used to request the link.
- `token`: one-time token from the email link.

### Optional Parameters

- `redirect`: optional same-origin frontend URL to preserve through the frontend success redirect.

### Validation Rules

- `email` must be a valid email address.
- `token` must be a non-empty string.
- `redirect`, when present, must be a string. Unsafe cross-origin values are ignored.
- The token must exist, match the email, be unexpired, and be unused.

### Successful Response

This route returns a redirect, not JSON.

- Status: `302`
- Sets `access-token` cookie.
- Redirects to `${APP_URL}/auth/magic-link/success`, preserving the safe `redirect` query when
  present.

### Dashboard Restriction Redirect

When the magic link is valid but the user cannot access the dashboard, no session cookie is issued.
Any existing `access-token` cookie is cleared, and the user is redirected to the login page with a
machine-readable `error` and human-readable `message` query parameter:

`/login?error=account_pending_approval&message=Your%20account%20is%20pending%20approval%20by%20an%20administrator.`

Possible restriction codes:

- `account_pending_approval`: the account exists but is waiting for administrator approval.
- `dashboard_role_not_allowed`: the account role is not included in system `allowedRoles`.

### Error Responses

- `422 validation_failed` when query parameters fail validation.
- `401 unauthorized` when the token is invalid, expired, or already used.

### Example Error Response

```json
{
	"statusCode": 401,
	"code": "unauthorized",
	"error": "Unauthorized",
	"message": "Invalid or expired magic link",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/magic-link/verify?email=user@example.com&token=token-value",
	"requestId": "req_123"
}
```

## Verify Magic Link With JSON

`POST /auth/magic-link/verify`

### Purpose

Verifies a one-time magic-link token from the frontend verify page and returns the authenticated
user.

### How It Works

The token is validated the same way as the redirect route. On success, dashboard access is checked, a
session token is created, the `access-token` cookie is set, and the user is returned in the standard
API envelope.

### Authentication

None.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

JSON body:

```json
{
	"email": "user@example.com",
	"token": "token-value",
	"redirectUrl": "http://localhost:3030/users"
}
```

### Optional Parameters

- `redirectUrl`: optional same-origin frontend URL for frontend clients to preserve while verifying.

### Validation Rules

- `email` must be a valid email address.
- `token` must be a non-empty string.
- `redirectUrl`, when present, must be a string. Unsafe cross-origin values should be ignored by
  clients and are accepted only as metadata by this endpoint.
- Unknown body fields are rejected.
- The token must exist, match the email, be unexpired, and be unused.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Magic link verified successfully",
	"data": {
		"id": "4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111",
		"name": null,
		"email": "user@example.com",
		"emailVerified": true,
		"image": null,
		"imageInformation": null,
		"phone": null,
		"is2faEnabled": false,
		"role": "USER",
		"createdAt": "2026-05-16T00:00:00.000Z",
		"updatedAt": "2026-05-16T00:00:00.000Z"
	},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/magic-link/verify"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `422 validation_failed` when the request body fails validation.
- `401 unauthorized` when the token is invalid, expired, already used, or the verified account is
  restricted from dashboard access. Restricted dashboard access responses include
  `meta.reason` as `account_pending_approval` or `dashboard_role_not_allowed`.

### Example Error Response

```json
{
	"statusCode": 401,
	"code": "unauthorized",
	"error": "Unauthorized",
	"message": "Magic link has expired",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/magic-link/verify",
	"requestId": "req_123"
}
```

## Two-Factor Authentication

Two-factor routes live under `/auth/2fa`. Unsafe methods require CSRF.

### `GET /auth/2fa/status`

Requires a fully authenticated session. Returns whether 2FA is enabled and the number of unused
recovery codes.

```json
{
	"enabled": true,
	"recoveryCodeCount": 8
}
```

### `POST /auth/2fa/setup/start`

Requires a fully authenticated session. Starts a pending TOTP setup and returns the QR data URL,
manual key, otpauth URL, and expiry. Starting a new setup replaces any previous pending setup.

```json
{
	"otpauthUrl": "otpauth://totp/example:user@example.com?secret=ABC...",
	"qrCodeDataUrl": "data:image/png;base64,...",
	"manualEntryKey": "ABCDEF...",
	"expiresAt": "2026-05-17T10:10:00.000Z"
}
```

### `POST /auth/2fa/setup/confirm`

Requires a fully authenticated session. Body: `{ "code": "123456" }`. The code must match the
pending TOTP secret. On success, 2FA is enabled, the current session is marked verified, and
recovery codes are returned once.

```json
{
	"recoveryCodes": ["ABCDE-12345", "FGHIJ-67890"]
}
```

### `POST /auth/2fa/verify`

Requires a valid partial session. Body: `{ "code": "123456" }`. Accepts a TOTP code or one unused
recovery code. On success, marks the current session as 2FA verified.

```json
{
	"verified": true
}
```

### `POST /auth/2fa/disable`

Requires a fully authenticated session. Body: `{ "code": "123456" }`. Accepts a TOTP or recovery
code, disables 2FA, deletes recovery codes and pending setup, and revokes other active sessions.

```json
{
	"disabled": true,
	"revokedOtherSessionCount": 2
}
```

### `POST /auth/2fa/recovery-codes/regenerate`

Requires a fully authenticated session. Body: `{ "code": "123456" }`. Accepts a TOTP or recovery
code, replaces old recovery codes, and returns the new codes once.

```json
{
	"recoveryCodes": ["ABCDE-12345", "FGHIJ-67890"]
}
```

### Two-Factor Errors

- `401 two_factor_required` when a valid first-factor session still needs 2FA before accessing a
  fully protected route.
- `401 unauthorized` for invalid, expired, locked, or replayed 2FA attempts.
- `404 two_factor_setup_not_found` when confirmation is attempted without a pending setup.

## Google Login

`POST /auth/google`

### Purpose

Authenticates a user with a Google ID token.

### How It Works

The Google credential is verified against `GOOGLE_CLIENT_ID`. The service links the Google account
to an existing user by email or creates a new user, checks dashboard access, creates a session, sets
the `access-token` cookie, and returns the user.

### Authentication

None.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

JSON body:

```json
{
	"credential": "google-id-token"
}
```

### Optional Parameters

None.

### Validation Rules

- `credential` must be a non-empty string.
- Unknown body fields are rejected.
- Google account email must be verified.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Google login successful",
	"data": {
		"id": "4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111",
		"name": "Amina Rahman",
		"email": "user@example.com",
		"emailVerified": true,
		"image": "https://res.cloudinary.com/example/profile.webp",
		"imageInformation": null,
		"phone": null,
		"is2faEnabled": false,
		"role": "USER",
		"createdAt": "2026-05-16T00:00:00.000Z",
		"updatedAt": "2026-05-16T00:00:00.000Z"
	},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/google"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `422 validation_failed` when the request body fails validation.
- `401 unauthorized` when the Google credential is invalid or the Google email is unverified.
- `401 unauthorized` when the account is restricted from dashboard access. The response includes
  `meta.reason` as `account_pending_approval` or `dashboard_role_not_allowed`.

### Example Error Response

```json
{
	"statusCode": 401,
	"code": "unauthorized",
	"error": "Unauthorized",
	"message": "Google authentication failed. Please try again.",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/google",
	"requestId": "req_123"
}
```

## Logout

`POST /auth/logout`

### Purpose

Revokes the current session and clears the access-token cookie. Logout accepts a partial session so
users can sign out even while 2FA verification is pending.

### How It Works

The JWT guard reads the `access-token` cookie, validates the session, and the controller revokes the
session token before clearing the cookie.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

None.

### Optional Parameters

None.

### Validation Rules

- The `access-token` cookie must exist.
- The session must exist, be unrevoked, and be unexpired.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Logout successful",
	"data": null,
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/logout"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `401 unauthorized` when the session token is missing, invalid, revoked, or expired.
- `400 bad_request` when no active session can be found on the request.

### Example Error Response

```json
{
	"statusCode": 401,
	"code": "unauthorized",
	"error": "Unauthorized",
	"message": "Invalid session token",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/logout",
	"requestId": "req_123"
}
```

## List Sessions

`GET /auth/sessions`

### Purpose

Returns the authenticated user's session and device history.

### How It Works

The JWT guard validates the current `access-token` cookie. The API filters, searches, sorts, and
paginates session records owned by the current user, computes each session status, and marks the
current session by comparing each stored session token to the current cookie value.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Not required because this is a safe `GET` route.

### Required Parameters

None.

### Optional Parameters

Query parameters:

- `page`: page number. Defaults to `1`.
- `pageSize`: rows per page. Defaults to `25`, maximum `100`.
- `search`: matches device name, device type, IP address, or user agent.
- `status`: comma-separated statuses: `active`, `revoked`, `expired`.
- `deviceType`: comma-separated device types, for example `desktop,mobile,tablet`.
- `fromDate`: created/login date lower bound in `YYYY-MM-DD` format.
- `toDate`: created/login date upper bound in `YYYY-MM-DD` format.
- `sort`: one of `deviceName`, `deviceType`, `ipAddress`, `userAgent`, `status`, `createdAt`,
  `expiresAt`. Defaults to `createdAt`.
- `dir`: `asc` or `desc`. Defaults to `desc`.

### Validation Rules

- The session must exist, be unrevoked, and be unexpired.
- Only sessions owned by the current user are returned.
- `fromDate` must be less than or equal to `toDate` when both are supplied.
- `status` is computed from `isRevoked` and `expiresAt`.
- Session tokens, numeric database IDs, and internal user IDs are never returned.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Sessions fetched successfully",
	"data": {
		"rows": [
			{
				"id": "7f44294a-3774-4604-9109-f32bc3a6e2c1",
				"deviceName": "Windows 11 - Chrome",
				"deviceType": "desktop",
				"ipAddress": "203.0.113.10",
				"userAgent": "Chrome - 125.0.0.0",
				"status": "active",
				"isCurrent": true,
				"isRevoked": false,
				"twoFactorVerified": false,
				"createdAt": "2026-05-16T00:00:00.000Z",
				"updatedAt": "2026-05-16T00:00:00.000Z",
				"expiresAt": "2026-05-23T00:00:00.000Z"
			}
		],
		"total": 1,
		"page": 1,
		"pageSize": 10,
		"activeOtherSessionCount": 0
	},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/sessions?page=1&pageSize=10"
}
```

### Error Responses

- `401 unauthorized` when the current session token is missing, invalid, revoked, expired, or
  blocked by pending 2FA.
- `422 validation_failed` when query parameters fail validation.

## Revoke Session

`POST /auth/sessions/:id/revoke`

### Purpose

Revokes one session owned by the authenticated user.

### How It Works

The route parameter is parsed as a UUID. The repository updates only a session matching both the
public session ID and the current user. The row is retained and marked revoked. If the target is the
current session, the `access-token` cookie is cleared.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

Path parameter:

- `id`: session public UUID.

### Optional Parameters

None.

### Validation Rules

- `id` must be a valid UUID.
- The target session must belong to the current user.
- Session tokens, numeric database IDs, and internal user IDs are never returned.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Session revoked successfully",
	"data": {
		"id": "7f44294a-3774-4604-9109-f32bc3a6e2c1",
		"deviceName": "Windows 11 - Chrome",
		"deviceType": "desktop",
		"ipAddress": "203.0.113.10",
		"userAgent": "Chrome - 125.0.0.0",
		"status": "revoked",
		"isCurrent": false,
		"isRevoked": true,
		"twoFactorVerified": false,
		"createdAt": "2026-05-16T00:00:00.000Z",
		"updatedAt": "2026-05-16T00:00:00.000Z",
		"expiresAt": "2026-05-23T00:00:00.000Z"
	},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/sessions/7f44294a-3774-4604-9109-f32bc3a6e2c1/revoke"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `401 unauthorized` when the current session token is missing, invalid, revoked, expired, or
  blocked by pending 2FA.
- `400 bad_request` when no active session can be found on the request or `id` is not a valid UUID.
- `404 session_not_found` when the target session does not exist for the current user.

## Revoke Other Sessions

`POST /auth/sessions/revoke-others`

### Purpose

Revokes all other active sessions for the authenticated user while keeping the current session
valid.

### How It Works

The JWT guard validates the current session. The repository marks every unrevoked, unexpired session
for the current user as revoked, excluding the current cookie token.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

None.

### Optional Parameters

None.

### Validation Rules

- The current session must exist, be unrevoked, and be unexpired.
- The current session is excluded from revocation.
- Already revoked or expired sessions are left unchanged.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Other sessions revoked successfully",
	"data": {
		"revokedCount": 2
	},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/sessions/revoke-others"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `401 unauthorized` when the current session token is missing, invalid, revoked, expired, or
  blocked by pending 2FA.
- `400 bad_request` when no active session can be found on the request.

## Get Current Profile

`GET /auth/me`

### Purpose

Returns the authenticated user's profile.

### How It Works

The JWT guard reads the `access-token` cookie, validates the session, and injects the current user
into the controller.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Not required because this is a safe `GET` route.

### Required Parameters

None.

### Optional Parameters

None.

### Validation Rules

- The session must exist, be unrevoked, and be unexpired.
- If two-factor authentication is enabled, the session must already be 2FA verified.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "User profile fetched successfully",
	"data": {
		"id": "4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111",
		"name": "Amina Rahman",
		"email": "user@example.com",
		"emailVerified": true,
		"image": null,
		"imageInformation": null,
		"phone": "+8801712345678",
		"is2faEnabled": false,
		"role": "USER",
		"createdAt": "2026-05-16T00:00:00.000Z",
		"updatedAt": "2026-05-16T00:00:00.000Z"
	},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/me"
}
```

### Error Responses

- `401 unauthorized` when the session token is missing, invalid, revoked, expired, or blocked by
  pending 2FA.

### Example Error Response

```json
{
	"statusCode": 401,
	"code": "unauthorized",
	"error": "Unauthorized",
	"message": "Unauthorized",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/me",
	"requestId": "req_123"
}
```

## Update Profile

`PUT /auth/profile`

### Purpose

Updates editable profile fields for the authenticated user.

### How It Works

The JWT guard validates the session. The request body is validated with the profile schema, then the
service updates the user record and returns the updated profile.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

None. At least one optional field is normally expected by clients, but the schema allows an empty
strict object.

### Optional Parameters

JSON body:

```json
{
	"name": "Amina Rahman",
	"image": "https://example.com/avatar.png",
	"phone": "+8801712345678"
}
```

### Validation Rules

- `name`, when present, must be a string.
- `image`, when present, must be a string.
- `phone`, when present, must be a valid phone number.
- Unknown body fields are rejected.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Profile updated successfully",
	"data": {
		"id": "4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111",
		"name": "Amina Rahman",
		"email": "user@example.com",
		"emailVerified": true,
		"image": "https://example.com/avatar.png",
		"imageInformation": null,
		"phone": "+8801712345678",
		"is2faEnabled": false,
		"role": "USER",
		"createdAt": "2026-05-16T00:00:00.000Z",
		"updatedAt": "2026-05-16T00:00:00.000Z"
	},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/profile"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `401 unauthorized` when the session token is missing, invalid, revoked, expired, or blocked by
  pending 2FA.
- `422 validation_failed` when the request body fails validation.

### Example Error Response

```json
{
	"statusCode": 422,
	"code": "validation_failed",
	"error": "Unprocessable Entity",
	"message": "Phone is not a valid phone number",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/profile",
	"requestId": "req_123"
}
```

## Upload Profile Image

`PUT /auth/profile/image`

### Purpose

Uploads and replaces the authenticated user's profile image.

### How It Works

The JWT guard validates the session. Multer reads the `avatar` file into memory, the file pipe
validates it, Cloudinary stores the image with face detection, the old image is removed when
available, and the updated user profile is returned.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

Multipart form-data:

- `avatar`: image file.

### Optional Parameters

None.

### Validation Rules

- `avatar` is required.
- Allowed MIME types are `image/png`, `image/jpeg`, and `image/webp`.
- Maximum file size is 2 MB.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Media uploaded successfully",
	"data": {
		"id": "4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111",
		"name": "Amina Rahman",
		"email": "user@example.com",
		"emailVerified": true,
		"image": "https://res.cloudinary.com/example/profile.webp",
		"imageInformation": null,
		"phone": "+8801712345678",
		"is2faEnabled": false,
		"role": "USER",
		"createdAt": "2026-05-16T00:00:00.000Z",
		"updatedAt": "2026-05-16T00:00:00.000Z"
	},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/profile/image"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `401 unauthorized` when the session token is missing, invalid, revoked, expired, or blocked by
  pending 2FA.
- `422 validation_failed` when the uploaded file fails validation.
- `400 bad_request` when image upload fails after validation.

### Example Error Response

```json
{
	"statusCode": 422,
	"code": "validation_failed",
	"error": "Unprocessable Entity",
	"message": "Unsupported file type: image/gif",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/auth/profile/image",
	"requestId": "req_123"
}
```
