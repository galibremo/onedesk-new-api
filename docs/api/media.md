# Media API

Media routes live under `/media`. All media routes require the `access-token` cookie. Unsafe media
routes also require CSRF protection.

Call `GET /csrf` first, keep the `csrf-token` cookie, and send the returned token as
`x-csrf-token` on unsafe methods.

## Upload Media

`POST /media`

### Purpose

Uploads a media file for the authenticated user.

### How It Works

The JWT guard validates the session. Multer reads the `file` upload into memory, the file pipe
validates it, the media policy enforces the per-user upload limit, Cloudinary stores the file, and
the media metadata is inserted into the database.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

Multipart form-data:

- `file`: image file.

### Optional Parameters

None.

### Validation Rules

- `file` is required.
- Allowed MIME types are `image/png`, `image/jpeg`, and `image/webp`.
- Maximum file size is 2 MB.
- A user can have at most 5 media items.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Media uploaded successfully",
	"data": true,
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `401 unauthorized` when the session token is missing, invalid, revoked, expired, or blocked by
  pending 2FA.
- `422 validation_failed` when the uploaded file fails validation.
- `422 media_upload_limit_reached` when the user already has 5 media items.
- `422 media_upload_failed` or `422 media_create_failed` when storage or database creation fails.

### Example Error Response

```json
{
	"statusCode": 422,
	"code": "media_upload_limit_reached",
	"error": "Unprocessable Entity",
	"message": "Media upload limit reached. Maximum allowed is 5 items.",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media",
	"requestId": "req_123"
}
```

## List Media

`GET /media`

### Purpose

Returns all media items uploaded by the authenticated user.

### How It Works

The JWT guard validates the session. The repository lists media records owned by the current user
and orders them by creation time.

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
- Only media uploaded by the current user is returned.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Media fetched successfully",
	"data": [
		{
			"publicId": "4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111",
			"filename": "banner.png",
			"mimeType": "image/png",
			"fileSize": 145000,
			"secureUrl": "https://res.cloudinary.com/example/banner.png",
			"mediaType": "image",
			"altText": "Dashboard banner",
			"width": 1200,
			"height": 630,
			"tags": [],
			"createdAt": "2026-05-16T00:00:00.000Z",
			"updatedAt": "2026-05-16T00:00:00.000Z"
		}
	],
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media"
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
	"message": "Invalid session token",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media",
	"requestId": "req_123"
}
```

## Update Media

`PUT /media/:id`

### Purpose

Updates editable metadata for one media item owned by the authenticated user.

### How It Works

The JWT guard validates the session. The route parameter is parsed as a UUID, the body is validated,
and the repository updates only a media record that matches both the public media ID and current
user.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

Path parameter:

- `id`: media public UUID.

JSON body:

```json
{
	"name": "banner.png",
	"altText": "Dashboard banner"
}
```

### Optional Parameters

None.

### Validation Rules

- `id` must be a UUID.
- `name` must be a string.
- `altText` must be a string.
- Unknown body fields are rejected.
- The media item must belong to the current user.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Media updated successfully",
	"data": true,
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media/4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `401 unauthorized` when the session token is missing, invalid, revoked, expired, or blocked by
  pending 2FA.
- `400 bad_request` when `id` is not a UUID.
- `422 validation_failed` when the request body fails validation.
- `404 media_not_found` when the media item does not exist for the current user.

### Example Error Response

```json
{
	"statusCode": 404,
	"code": "media_not_found",
	"error": "Not Found",
	"message": "Media not found",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media/4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111",
	"requestId": "req_123"
}
```

## Delete Media

`DELETE /media/:id`

### Purpose

Deletes one media item owned by the authenticated user.

### How It Works

The JWT guard validates the session. The route parameter is parsed as a UUID, the repository deletes
only a media record that matches both the public media ID and current user, and the storage item is
deleted from Cloudinary.

### Authentication

Required. Send a valid `access-token` cookie.

### CSRF

Required. Send `x-csrf-token` and the matching `csrf-token` cookie.

### Required Parameters

Path parameter:

- `id`: media public UUID.

### Optional Parameters

None.

### Validation Rules

- `id` must be a UUID.
- The media item must belong to the current user.

### Successful Response

```json
{
	"statusCode": 200,
	"message": "Media deleted successfully",
	"data": true,
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media/4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111"
}
```

### Error Responses

- `403 csrf_invalid` when the CSRF token is missing or invalid.
- `401 unauthorized` when the session token is missing, invalid, revoked, expired, or blocked by
  pending 2FA.
- `400 bad_request` when `id` is not a UUID.
- `404 media_not_found` when the media item does not exist for the current user.

### Example Error Response

```json
{
	"statusCode": 404,
	"code": "media_not_found",
	"error": "Not Found",
	"message": "Media not found",
	"meta": {},
	"timestamp": "2026-05-16T00:00:00.000Z",
	"path": "/media/4d95ad1f-0c6b-46b9-8f9d-6ef8ad99a111",
	"requestId": "req_123"
}
```
