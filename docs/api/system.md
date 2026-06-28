# System API

Application-level configuration for access control and role management.

## `GET /system/settings/public`

Returns the public-facing system settings. No authentication required.

### Example Request

```http
GET /system/settings/public
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "Public settings fetched successfully",
	"data": {
		"accessModel": "OPEN",
		"allowedRoles": ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"]
	},
	"timestamp": "2026-05-23T00:00:00.000Z",
	"path": "/system/settings/public"
}
```

### Response Fields

- `accessModel`: One of `OPEN`, `APPROVAL_BASED`, or `CLOSED`. Controls how users gain access to the application.
- `allowedRoles`: Array of role strings that are active in the system.

---

## `GET /system/settings`

Returns the full system settings including internal fields. Requires `ADMIN` role.

**Auth**: `access-token` cookie + `ADMIN` role.

### Example Request

```http
GET /system/settings
Cookie: access-token=eyJ...
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "Settings fetched successfully",
	"data": {
		"id": 1,
		"accessModel": "OPEN",
		"allowedRoles": ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"],
		"createdAt": "2026-01-01T00:00:00.000Z",
		"updatedAt": "2026-05-23T00:00:00.000Z"
	},
	"timestamp": "2026-05-23T00:00:00.000Z",
	"path": "/system/settings"
}
```

---

## `PATCH /system/settings`

Updates system settings. Requires `ADMIN` role and CSRF protection.

**Auth**: `access-token` cookie + `ADMIN` role + CSRF token.

### Request Body

At least one field must be provided.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accessModel` | `string` | No | One of `OPEN`, `APPROVAL_BASED`, `CLOSED`. |
| `allowedRoles` | `string[]` | No | Array of active role strings. Valid values: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `USER`. |

### Example Request

```http
PATCH /system/settings
Cookie: access-token=eyJ...
x-csrf-token: abc123...
Content-Type: application/json

{
	"accessModel": "APPROVAL_BASED"
}
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "Settings updated successfully",
	"data": {
		"id": 1,
		"accessModel": "APPROVAL_BASED",
		"allowedRoles": ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"],
		"createdAt": "2026-01-01T00:00:00.000Z",
		"updatedAt": "2026-05-23T00:00:00.000Z"
	},
	"timestamp": "2026-05-23T00:00:00.000Z",
	"path": "/system/settings"
}
```

### Validation Errors

- Empty body (no fields provided): `code: "validation_failed"`, message: "At least one field must be provided to update".
- Invalid `accessModel` value: `code: "validation_failed"`, message: "Access Model must be one of the following values: OPEN, APPROVAL_BASED, CLOSED".
- Invalid role in `allowedRoles`: `code: "validation_failed"`, message: "Role must be one of the following values: SUPER_ADMIN, ADMIN, MANAGER, USER".

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 401 | `unauthorized` | Missing or invalid access token. |
| 403 | `forbidden` | Caller does not have the `ADMIN` role. |
| 422 | `validation_failed` | Request body failed validation. |
