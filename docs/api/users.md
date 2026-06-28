# Users API

Admin-only user directory and access-management endpoints.

All routes require the `access-token` HTTP-only cookie and the caller must have an admin role.
Unsafe methods require a CSRF token from `GET /csrf` sent as `x-csrf-token`.

Authorization rules for management actions:

- `SUPER_ADMIN` can manage any non-self user and can assign any role.
- `ADMIN` can manage only `USER` and `MANAGER` users and can assign only `USER` or `MANAGER`.
- Users cannot manage their own account through this module.

## `GET /users`

Lists users for the dashboard directory.

### Query Parameters

Required: none.

Optional:

- `page`: positive integer, defaults to `1`.
- `pageSize`: positive integer, defaults to `25`, maximum `500`.
- `search`: searches name, email, and phone.
- `role`: comma-separated roles from `ADMIN`, `MANAGER`, `USER`, `SUPER_ADMIN`.
- `emailVerified`: `true` or `false`.
- `fromDate`: created-at lower bound.
- `toDate`: created-at upper bound.
- `sort`: one of `name`, `email`, `emailVerified`, `is2faEnabled`, `role`, `activeSessionCount`,
  `createdAt`, `updatedAt`.
- `dir`: `asc` or `desc`.

### Example Request

```http
GET /users?page=1&pageSize=10&role=USER,MANAGER&emailVerified=true&sort=createdAt&dir=desc
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "Users fetched successfully",
	"data": {
		"rows": [
			{
				"id": "9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7",
				"name": "Avery Stone",
				"email": "avery@example.com",
				"image": null,
				"phone": null,
				"emailVerified": true,
				"is2faEnabled": false,
				"role": "USER",
				"activeSessionCount": 2,
				"createdAt": "2026-05-17T10:00:00.000Z",
				"updatedAt": "2026-05-17T10:00:00.000Z"
			}
		],
		"total": 1,
		"page": 1,
		"pageSize": 10
	},
	"timestamp": "2026-05-17T10:00:00.000Z",
	"path": "/users"
}
```

## `GET /users/:id`

Fetches one managed user by public user UUID. The same conservative management rules apply, so
admins cannot fetch their own account through this module.

### Example Request

```http
GET /users/9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "User fetched successfully",
	"data": {
		"id": "9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7",
		"name": "Avery Stone",
		"email": "avery@example.com",
		"image": null,
		"phone": null,
		"emailVerified": true,
		"is2faEnabled": false,
		"role": "USER",
		"isApproved": true,
		"activeSessionCount": 2,
		"createdAt": "2026-05-17T10:00:00.000Z",
		"updatedAt": "2026-05-17T10:00:00.000Z"
	},
	"timestamp": "2026-05-17T10:00:00.000Z",
	"path": "/users/9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7"
}
```

## `POST /users`

Creates a managed user account.

### Body

```json
{
	"name": "Avery Stone",
	"email": "avery@example.com",
	"password": "Passw0rd",
	"phone": "+14155552671",
	"emailVerified": true,
	"role": "USER"
}
```

`name`, `password`, `phone`, and `emailVerified` are optional. Empty optional strings are stored as
`null`. Email addresses are normalized to lowercase. Role assignment follows the hierarchy rules
above. 2FA cannot be enabled through this endpoint.

### Example Success

```json
{
	"statusCode": 201,
	"message": "User created successfully",
	"data": {
		"id": "9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7",
		"name": "Avery Stone",
		"email": "avery@example.com",
		"image": null,
		"phone": "+14155552671",
		"emailVerified": true,
		"is2faEnabled": false,
		"role": "USER",
		"activeSessionCount": 0,
		"createdAt": "2026-05-17T10:00:00.000Z",
		"updatedAt": "2026-05-17T10:00:00.000Z"
	},
	"timestamp": "2026-05-17T10:00:00.000Z",
	"path": "/users"
}
```

## `PATCH /users/:id`

Updates a target user's account fields. `:id` is the public user UUID.

### Body

At least one field is required.

```json
{
	"name": "Avery Stone",
	"email": "avery.stone@example.com",
	"phone": "+14155552671",
	"emailVerified": true
}
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "User updated successfully",
	"data": {
		"id": "9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7",
		"name": "Avery Stone",
		"email": "avery.stone@example.com",
		"image": null,
		"phone": "+14155552671",
		"emailVerified": true,
		"is2faEnabled": false,
		"role": "USER",
		"activeSessionCount": 2,
		"createdAt": "2026-05-17T10:00:00.000Z",
		"updatedAt": "2026-05-17T10:05:00.000Z"
	},
	"timestamp": "2026-05-17T10:05:00.000Z",
	"path": "/users/9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7"
}
```

## `PATCH /users/:id/role`

Updates a user's role. `:id` is the public user UUID.

### Body

```json
{
	"role": "MANAGER"
}
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "User role updated successfully",
	"data": {
		"id": "9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7",
		"name": "Avery Stone",
		"email": "avery@example.com",
		"image": null,
		"phone": null,
		"emailVerified": true,
		"is2faEnabled": false,
		"role": "MANAGER",
		"activeSessionCount": 2,
		"createdAt": "2026-05-17T10:00:00.000Z",
		"updatedAt": "2026-05-17T10:05:00.000Z"
	},
	"timestamp": "2026-05-17T10:05:00.000Z",
	"path": "/users/9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7/role"
}
```

## `DELETE /users/:id`

Deletes a target user. `:id` is the public user UUID.

### Example Success

```json
{
	"statusCode": 200,
	"message": "User deleted successfully",
	"data": {
		"deleted": true
	},
	"timestamp": "2026-05-17T10:08:00.000Z",
	"path": "/users/9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7"
}
```

## `POST /users/:id/2fa/reset`

Disables 2FA for a target user and revokes all of their sessions. `:id` is the public user UUID. The
same conservative management rules apply.

### Example Success

```json
{
	"statusCode": 200,
	"message": "User two-factor authentication reset successfully",
	"data": {
		"reset": true,
		"revokedCount": 3
	},
	"timestamp": "2026-05-17T10:09:00.000Z",
	"path": "/users/9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7/2fa/reset"
}
```

## `POST /users/:id/sessions/revoke`

Revokes all non-revoked sessions for a target user. `:id` is the public user UUID.

The same conservative management rules apply.

### Example Success

```json
{
	"statusCode": 200,
	"message": "User sessions revoked successfully",
	"data": {
		"revokedCount": 2
	},
	"timestamp": "2026-05-17T10:10:00.000Z",
	"path": "/users/9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7/sessions/revoke"
}
```

## Errors

Validation errors use `code: "validation_failed"`. Missing or invalid auth uses `unauthorized`.
Insufficient role or hierarchy violations use `forbidden`. Missing target users use
`user_not_found`. Duplicate emails use `email_already_exists`.

```json
{
	"statusCode": 403,
	"code": "forbidden",
	"error": "Forbidden",
	"message": "You don't have permission to manage this user.",
	"meta": {},
	"timestamp": "2026-05-17T10:10:00.000Z",
	"path": "/users/9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7/role",
	"requestId": "req_123"
}
```
