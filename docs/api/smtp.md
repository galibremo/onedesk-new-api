# SMTP Providers API

Admin-only endpoints for managing SMTP email providers. Supports Brevo, Resend, generic SMTP (nodemailer), and AWS SES.

> **Note:** This is the active email sending system for the application. All auth emails (magic links, welcome, approval, invitation, 2FA alerts) are dispatched through `EmailDispatcherService`, which reads provider configuration from the database. At least one active SMTP provider must exist in the `smtp_providers` table for emails to be sent.

All routes require the `access-token` HTTP-only cookie and the caller must have an admin role.
Unsafe methods require a CSRF token from `GET /csrf` sent as `x-csrf-token`.

## Provider Types

| Type | Description | Required Config Fields |
|------|-------------|----------------------|
| `brevo` | Brevo (Sendinblue) transactional email | `apiKey`, `senderEmail`, `senderName` |
| `resend` | Resend email service | `apiKey`, `senderEmail`, `senderName` |
| `nodemailer` | Generic SMTP server | `host`, `port`, `secure`, `auth.user`, `auth.pass`, `senderEmail`, `senderName` |
| `aws-ses` | Amazon SES | `accessKeyId`, `secretAccessKey`, `region`, `senderEmail`, `senderName` |

## `GET /smtp-providers`

Lists all SMTP providers with pagination.

### Query Parameters

Optional:
- `page`: positive integer, defaults to `1`.
- `pageSize`: positive integer, defaults to `10`, maximum `500`.
- `search`: searches name and provider type.
- `providerType`: filter by type (`brevo`, `resend`, `nodemailer`, `aws-ses`).
- `isActive`: `true` or `false`.
- `sort`: one of `name`, `providerType`, `isDefault`, `isActive`, `lastTestStatus`, `createdAt`, `updatedAt`.
- `dir`: `asc` or `desc`.

### Example Request

```http
GET /smtp-providers?page=1&pageSize=10&isActive=true&sort=createdAt&dir=desc
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "SMTP providers fetched successfully",
	"data": {
		"rows": [
			{
				"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				"name": "Production Brevo",
				"providerType": "brevo",
				"config": {
					"apiKey": "••••••••",
					"senderEmail": "noreply@example.com",
					"senderName": "My App"
				},
				"isDefault": true,
				"isActive": true,
				"lastTestedAt": "2026-05-25T10:00:00.000Z",
				"lastTestStatus": "success",
				"createdAt": "2026-05-20T08:00:00.000Z",
				"updatedAt": "2026-05-25T10:00:00.000Z"
			}
		],
		"total": 1,
		"page": 1,
		"pageSize": 10
	},
	"timestamp": "2026-05-25T10:00:00.000Z",
	"path": "/smtp-providers"
}
```

## `GET /smtp-providers/:id`

Fetches one SMTP provider by public ID. Sensitive config fields are masked.

### Example Request

```http
GET /smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "SMTP provider fetched successfully",
	"data": {
		"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"name": "Production Brevo",
		"providerType": "brevo",
		"config": {
			"apiKey": "••••••••",
			"senderEmail": "noreply@example.com",
			"senderName": "My App"
		},
		"isDefault": true,
		"isActive": true,
		"lastTestedAt": "2026-05-25T10:00:00.000Z",
		"lastTestStatus": "success",
		"createdAt": "2026-05-20T08:00:00.000Z",
		"updatedAt": "2026-05-25T10:00:00.000Z"
	},
	"timestamp": "2026-05-25T10:00:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

## `POST /smtp-providers`

Creates a new SMTP provider. The first active provider created is automatically set as default.

### Body

```json
{
	"name": "Production Brevo",
	"providerType": "brevo",
	"config": {
		"apiKey": "xkeysib-...",
		"senderEmail": "noreply@example.com",
		"senderName": "My App"
	}
}
```

### Example Success

```json
{
	"statusCode": 201,
	"message": "SMTP provider created successfully",
	"data": {
		"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"name": "Production Brevo",
		"providerType": "brevo",
		"config": {
			"apiKey": "••••••••",
			"senderEmail": "noreply@example.com",
			"senderName": "My App"
		},
		"isDefault": true,
		"isActive": true,
		"lastTestedAt": null,
		"lastTestStatus": null,
		"createdAt": "2026-05-25T10:00:00.000Z",
		"updatedAt": "2026-05-25T10:00:00.000Z"
	},
	"timestamp": "2026-05-25T10:00:00.000Z",
	"path": "/smtp-providers"
}
```

## `PATCH /smtp-providers/:id`

Updates a provider's name or config. Sensitive config fields are re-encrypted on update.

### Body

At least one field is required.

```json
{
	"name": "Updated Name",
	"config": {
		"apiKey": "new-api-key",
		"senderEmail": "new@example.com",
		"senderName": "New Name"
	}
}
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "SMTP provider updated successfully",
	"data": {
		"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"name": "Updated Name",
		"providerType": "brevo",
		"config": {
			"apiKey": "••••••••",
			"senderEmail": "new@example.com",
			"senderName": "New Name"
		},
		"isDefault": true,
		"isActive": true,
		"lastTestedAt": "2026-05-25T10:00:00.000Z",
		"lastTestStatus": "success",
		"createdAt": "2026-05-20T08:00:00.000Z",
		"updatedAt": "2026-05-25T11:00:00.000Z"
	},
	"timestamp": "2026-05-25T11:00:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

## `DELETE /smtp-providers/:id`

Deletes an SMTP provider. Cannot delete the only active provider.

### Example Success

```json
{
	"statusCode": 200,
	"message": "SMTP provider deleted successfully",
	"data": {
		"deleted": true
	},
	"timestamp": "2026-05-25T12:00:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

## `POST /smtp-providers/:id/test`

Tests the connection for a provider. Updates `lastTestedAt` and `lastTestStatus`.

### Example Success

```json
{
	"statusCode": 200,
	"message": "Connection test successful",
	"data": {
		"success": true,
		"message": "Brevo connection successful"
	},
	"timestamp": "2026-05-25T12:00:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/test"
}
```

### Example Failure

```json
{
	"statusCode": 200,
	"message": "Connection test failed",
	"data": {
		"success": false,
		"message": "Brevo connection failed: Invalid API key"
	},
	"timestamp": "2026-05-25T12:00:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/test"
}
```

## `POST /smtp-providers/:id/set-default`

Sets a provider as the default. Unsets the previous default. The provider must be active.

### Example Success

```json
{
	"statusCode": 200,
	"message": "Default SMTP provider set successfully",
	"data": {
		"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"name": "Production Brevo",
		"providerType": "brevo",
		"config": {
			"apiKey": "••••••••",
			"senderEmail": "noreply@example.com",
			"senderName": "My App"
		},
		"isDefault": true,
		"isActive": true,
		"lastTestedAt": null,
		"lastTestStatus": null,
		"createdAt": "2026-05-20T08:00:00.000Z",
		"updatedAt": "2026-05-25T13:00:00.000Z"
	},
	"timestamp": "2026-05-25T13:00:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/set-default"
}
```

## `PATCH /smtp-providers/:id/toggle`

Toggles a provider's active status.

### Example Success

```json
{
	"statusCode": 200,
	"message": "SMTP provider toggled successfully",
	"data": {
		"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"name": "Production Brevo",
		"providerType": "brevo",
		"config": {
			"apiKey": "••••••••",
			"senderEmail": "noreply@example.com",
			"senderName": "My App"
		},
		"isDefault": true,
		"isActive": false,
		"lastTestedAt": null,
		"lastTestStatus": null,
		"createdAt": "2026-05-20T08:00:00.000Z",
		"updatedAt": "2026-05-25T14:00:00.000Z"
	},
	"timestamp": "2026-05-25T14:00:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/toggle"
}
```

## `GET /smtp-providers/:id/email-logs`

Lists email send attempts for a specific SMTP provider with pagination. One log entry is created per recipient for each send attempt.

### Query Parameters

Optional:
- `page`: positive integer, defaults to `1`.
- `pageSize`: positive integer, defaults to `10`, maximum `500`.
- `toEmail`: filter by recipient email (exact match).
- `status`: filter by status (`sent` or `failed`).
- `templateKey`: filter by template key (e.g., `auth_magic_link`).
- `sort`: one of `toEmail`, `status`, `templateKey`, `createdAt`.
- `dir`: `asc` or `desc`.
- `fromDate`: filter logs created on or after this date (ISO 8601).
- `toDate`: filter logs created on or before this date (ISO 8601).

### Example Request

```http
GET /smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/email-logs?page=1&pageSize=10&status=sent&sort=createdAt&dir=desc
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "Email logs fetched successfully",
	"data": {
		"rows": [
			{
				"id": "log-uuid-1",
				"smtpProviderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				"toEmail": "user@example.com",
				"toName": "John Doe",
				"subject": "Verify your email address",
				"templateKey": "auth_magic_link",
				"status": "sent",
				"errorMessage": null,
				"metadata": {},
				"createdAt": "2026-05-26T10:00:00.000Z",
				"updatedAt": "2026-05-26T10:00:00.000Z"
			},
			{
				"id": "log-uuid-2",
				"smtpProviderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				"toEmail": "user@example.com",
				"toName": "John Doe",
				"subject": "Verify your email address",
				"templateKey": "auth_magic_link",
				"status": "failed",
				"errorMessage": "Connection refused",
				"metadata": {},
				"createdAt": "2026-05-26T09:55:00.000Z",
				"updatedAt": "2026-05-26T09:55:00.000Z"
			}
		],
		"total": 2,
		"page": 1,
		"pageSize": 10
	},
	"timestamp": "2026-05-26T10:05:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/email-logs"
}
```

## `GET /smtp-providers/:id/email-logs/:logId`

Fetches a single email log entry by its public ID. The log must belong to the specified provider.

### Example Request

```http
GET /smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/email-logs/log-uuid-1
```

### Example Success

```json
{
	"statusCode": 200,
	"message": "Email log fetched successfully",
	"data": {
		"id": "log-uuid-1",
		"smtpProviderId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"toEmail": "user@example.com",
		"toName": "John Doe",
		"subject": "Verify your email address",
		"templateKey": "auth_magic_link",
		"status": "sent",
		"errorMessage": null,
		"metadata": {},
		"createdAt": "2026-05-26T10:00:00.000Z",
		"updatedAt": "2026-05-26T10:00:00.000Z"
	},
	"timestamp": "2026-05-26T10:05:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/email-logs/log-uuid-1"
}
```

## `GET /email-logs`

Lists all email send attempts across all SMTP providers with pagination. Supports filtering by provider, recipient, status, template, and date range.

### Query Parameters

Optional:
- `page`: positive integer, defaults to `1`.
- `pageSize`: positive integer, defaults to `10`, maximum `500`.
- `providerId`: filter by SMTP provider public ID.
- `toEmail`: filter by recipient email (exact match).
- `status`: filter by status (`sent` or `failed`).
- `templateKey`: filter by template key.
- `sort`: one of `toEmail`, `status`, `templateKey`, `createdAt`.
- `dir`: `asc` or `desc`.
- `fromDate`, `toDate`: date range on `createdAt`.

### Example Success

```json
{
	"statusCode": 200,
	"message": "Email logs fetched successfully",
	"data": {
		"rows": [
			{
				"id": "log-uuid-1",
				"smtpProviderId": "provider-uuid",
				"toEmail": "user@example.com",
				"toName": "John Doe",
				"subject": "Verify your email address",
				"templateKey": "auth_magic_link",
				"status": "sent",
				"errorMessage": null,
				"metadata": {},
				"createdAt": "2026-05-26T10:00:00.000Z",
				"updatedAt": "2026-05-26T10:00:00.000Z"
			}
		],
		"total": 1,
		"page": 1,
		"pageSize": 10
	},
	"timestamp": "2026-05-26T10:05:00.000Z",
	"path": "/email-logs"
}
```

## `GET /email-logs/:logId`

Fetches a single email log entry by its public ID.

### Example Success

```json
{
	"statusCode": 200,
	"message": "Email log fetched successfully",
	"data": {
		"id": "log-uuid-1",
		"smtpProviderId": "provider-uuid",
		"toEmail": "user@example.com",
		"toName": "John Doe",
		"subject": "Verify your email address",
		"templateKey": "auth_magic_link",
		"status": "sent",
		"errorMessage": null,
		"metadata": {},
		"createdAt": "2026-05-26T10:00:00.000Z",
		"updatedAt": "2026-05-26T10:00:00.000Z"
	},
	"timestamp": "2026-05-26T10:05:00.000Z",
	"path": "/email-logs/log-uuid-1"
}
```

## `POST /email-logs/:logId/resend`

Re-sends the email from a log entry. Only works for template-based emails (logs with a `templateKey`). Creates a new log entry for the resend attempt.

### Example Success

```json
{
	"statusCode": 200,
	"message": "Email resent successfully",
	"data": {
		"id": "log-uuid-2",
		"smtpProviderId": "provider-uuid",
		"toEmail": "user@example.com",
		"toName": "John Doe",
		"subject": "Verify your email address",
		"templateKey": "auth_magic_link",
		"status": "sent",
		"errorMessage": null,
		"metadata": {},
		"createdAt": "2026-05-26T10:10:00.000Z",
		"updatedAt": "2026-05-26T10:10:00.000Z"
	},
	"timestamp": "2026-05-26T10:10:00.000Z",
	"path": "/email-logs/log-uuid-1/resend"
}
```

### Example Failure (raw email)

```json
{
	"statusCode": 502,
	"code": "cannot_resend_raw_email",
	"error": "Bad Gateway",
	"message": "Cannot resend: no template associated with this email",
	"meta": {},
	"timestamp": "2026-05-26T10:10:00.000Z",
	"path": "/email-logs/log-uuid-1/resend",
	"requestId": "req_123"
}
```

## `DELETE /email-logs/:logId`

Deletes a single email log entry. Does not affect the original email that was sent.

### Example Success

```json
{
	"statusCode": 200,
	"message": "Email log deleted successfully",
	"data": {
		"deleted": true
	},
	"timestamp": "2026-05-26T10:15:00.000Z",
	"path": "/email-logs/log-uuid-1"
}
```

## Errors

Validation errors use `code: "validation_failed"`. Missing or invalid auth uses `unauthorized`.
Insufficient role uses `forbidden`. Missing target providers use `smtp_provider_not_found`.
Deleting the only active provider uses `cannot_delete_last_active_provider`. Setting an inactive
provider as default uses `cannot_set_inactive_default`. All provider send failures use
`email_send_failed` with a `failures` array in `meta`. Missing email logs use `email_log_not_found`.
Resend failures use `cannot_resend_raw_email` (no template) or `email_resend_failed` (send error).

```json
{
	"statusCode": 403,
	"code": "forbidden",
	"error": "Forbidden",
	"message": "Cannot delete the only active SMTP provider. Deactivate it first or add another provider.",
	"meta": {},
	"timestamp": "2026-05-25T10:10:00.000Z",
	"path": "/smtp-providers/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	"requestId": "req_123"
}
```
