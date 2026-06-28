# Health API

Service health checks for database connectivity and memory usage.

## `GET /health`

Returns the health status of the service. No authentication required. Rate limiting is disabled for this endpoint.

### Example Request

```http
GET /health
```

### Example Success

```json
{
	"status": "ok",
	"info": {
		"database": { "status": "up" },
		"memory_heap": { "status": "up" },
		"memory_rss": { "status": "up" }
	},
	"error": {},
	"details": {
		"database": { "status": "up" },
		"memory_heap": { "status": "up" },
		"memory_rss": { "status": "up" }
	}
}
```

### Example Failure

```json
{
	"status": "error",
	"info": {
		"database": { "status": "up" }
	},
	"error": {
		"memory_heap": {
			"status": "down",
			"message": "Heap memory limit exceeded"
		}
	},
	"details": {
		"database": { "status": "up" },
		"memory_heap": {
			"status": "down",
			"message": "Heap memory limit exceeded"
		},
		"memory_rss": { "status": "up" }
	}
}
```

### Health Checks

| Check | Description | Configurable |
|-------|-------------|--------------|
| `database` | PostgreSQL connection pool ping via Drizzle ORM. | No |
| `memory_heap` | Verifies Node.js heap memory is below the configured limit. | Yes — `HEALTH_HEAP_LIMIT_MB` (default: 150) |
| `memory_rss` | Verifies Node.js RSS memory is below the configured limit. | Yes — `HEALTH_RSS_LIMIT_MB` (default: 300) |

### Configuration

Memory limits are set via environment variables:

```env
HEALTH_HEAP_LIMIT_MB="150"
HEALTH_RSS_LIMIT_MB="300"
```

If not set, defaults to 150 MB for heap and 300 MB for RSS.

## Errors

This endpoint returns HTTP 200 for both healthy and unhealthy states. The `status` field in the response body indicates health:

- `"ok"`: All checks passed.
- `"error"`: One or more checks failed.

HTTP 503 is returned when the overall status is `"error"`.
