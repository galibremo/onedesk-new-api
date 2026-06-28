# Audit Logs API

Admin-only activity history for sensitive account and access events.

All routes require the `access-token` HTTP-only cookie and the caller must have an admin role.

## `GET /audit-logs/filter-options`

Returns distinct audit log actions and target types currently present in the database. Used to
populate filter dropdowns in the audit logs UI.

### Query Parameters

None.

### Example Request

```http
GET /audit-logs/filter-options
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "Audit log filter options fetched successfully",
	"data": {
		"actions": [
			"2FA_DISABLED",
			"2FA_ENABLED",
			"2FA_RESET",
			"LOGIN_SUCCESS",
			"ROLE_UPDATED",
			"USER_CREATED",
			"USER_DELETED",
			"USER_PROVISIONED",
			"USER_SESSIONS_REVOKED",
			"USER_UPDATED"
		],
		"targetTypes": ["user"]
	},
	"timestamp": "2026-05-17T10:05:00.000Z",
	"path": "/audit-logs/filter-options"
}
```

Arrays are sorted alphabetically. Empty arrays are returned when no audit logs exist.

## `GET /audit-logs`

Lists audit log entries newest-first by default. Public responses expose public UUIDs only.

### Query Parameters

Required: none.

Optional:

- `page`: positive integer, defaults to `1`.
- `pageSize`: positive integer, defaults to `10`, maximum `500`.
- `actorId`: public user UUID for the actor.
- `action`: exact action name, such as `USER_CREATED`, `LOGIN_SUCCESS`, or `2FA_DISABLED`.
- `targetType`: exact target type, such as `user` or `session`.
- `fromDate`: created-at lower bound.
- `toDate`: created-at upper bound.
- `sort`: one of `action`, `actorRole`, `targetType`, `targetId`, `createdAt`, `updatedAt`.
- `dir`: `asc` or `desc`.

### Example Request

```http
GET /audit-logs?page=1&pageSize=10&action=ROLE_UPDATED&sort=createdAt&dir=desc
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "Audit logs fetched successfully",
	"data": {
		"rows": [
			{
				"id": "4f2d3f58-6e6a-4f34-9f80-a782e4ea5a78",
				"actorId": "9c0b55fe-4e2f-4fd0-8ce2-fc0f8f39a0c7",
				"actorRole": "ADMIN",
				"action": "ROLE_UPDATED",
				"targetType": "user",
				"targetId": "b8d0d81f-5486-46ac-a89d-32c642645f10",
				"metadata": {
					"from": "USER",
					"to": "MANAGER",
					"changed": true
				},
				"ipAddress": "203.0.113.10",
				"userAgent": "Chrome - 124.0",
				"createdAt": "2026-05-17T10:05:00.000Z",
				"updatedAt": "2026-05-17T10:05:00.000Z"
			}
		],
		"total": 1,
		"page": 1,
		"pageSize": 10
	},
	"timestamp": "2026-05-17T10:05:00.000Z",
	"path": "/audit-logs"
}
```

System-initiated events use `actorId: null` and `actorRole: null`.

## Errors

Validation errors use `code: "validation_failed"`. Missing or invalid auth uses `unauthorized`.
Insufficient role uses `forbidden`.
