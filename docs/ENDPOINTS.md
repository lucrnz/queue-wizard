# API Endpoints

## GET /health

Health check endpoint.

- **Auth:** None

**Response (200):**

```json
{ "success": true, "data": { "status": "healthy", "timestamp": "..." } }
```

---

## POST /auth/signup

Create a new user account.

- **Auth:** None

**Request Body:**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | 1-255 chars |
| `email` | string | Yes | Valid email |
| `password` | string | Yes | Min 6 chars |

**Response (201):**

```json
{ "success": true, "data": { "user": { "id", "name", "email", "createdAt" } } }
```

**Errors:** `400` validation, `409` email exists

---

## POST /auth/signin

Authenticate and get JWT token.

- **Auth:** None

**Request Body:**
| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `password` | string | Yes |

**Response (200):**

```json
{ "success": true, "data": { "token": "...", "user": { "id", "name", "email" } } }
```

**Errors:** `400` validation, `401` invalid credentials

---

## POST /jobs

Create a new HTTP job.

- **Auth:** JWT required

**Request Body:**
| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `method` | string | Yes | - | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `url` | string | Yes | - | Valid URL |
| `priority` | integer | No | `0` | Lower = higher priority |
| `headers` | string | No | `"{}"` | Valid JSON string |
| `body` | string | No | `null` | Valid JSON string or null |

**Response (201):**

```json
{ "success": true, "data": { "job": { "id", "priority", "method", "url", "headers", "body", "status", "attempts", "result", "errorMessage", "createdAt", "updatedAt", "userId" } } }
```

**Errors:** `400` validation, `401` unauthorized

---

## POST /jobs/batch

Create multiple HTTP jobs atomically in a single request.

- **Auth:** JWT required

**Request Body:**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `jobs` | array | Yes | 1–100 items, each matching `POST /jobs` body schema |

Each element in `jobs` accepts the same fields as `POST /jobs`:

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `method` | string | Yes | - | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `url` | string | Yes | - | Valid URL |
| `priority` | integer | No | `0` | Lower = higher priority |
| `headers` | string | No | `"{}"` | Valid JSON string |
| `body` | string | No | `null` | Valid JSON string or null |

**Behavior:**
- All items are validated up-front with Zod; if **any** item fails, no jobs are created.
- Valid items are inserted inside a Prisma `$transaction` for atomicity.
- Validation errors include per-item paths (e.g., `jobs.2.url`) so the caller knows which item failed.

**Response (201):**

```json
{ "success": true, "data": { "jobs": [ { ...job }, { ...job } ], "count": 2 } }
```

**Errors:** `400` validation (per-item details), `401` unauthorized

---

## GET /jobs

List authenticated user's jobs.

- **Auth:** JWT required

**Query Parameters:**
| Parameter | Type | Required | Values |
|-----------|------|----------|--------|
| `status` | string | No | `pending`, `processing`, `completed`, `failed`, `cancelled` |

**Response (200):**

```json
{ "success": true, "data": { "jobs": [...], "count": 1 } }
```

Jobs ordered by priority (asc), then createdAt (desc).

**Errors:** `400` invalid status, `401` unauthorized

---

## GET /queue/status

Queue status overview.

- **Auth:** JWT required

**Response (200):**

```json
{
  "success": true,
  "data": {
    "pendingCount": 0,
    "processingCount": 0,
    "completedToday": 0,
    "failedCount": 0,
    "currentWorkers": 0,
    "maxConcurrent": 5
  }
}
```

**Errors:** `401` unauthorized

---

## GET /jobs/:id

Get a single job by ID.

- **Auth:** JWT required

**Path Parameters:**
| Parameter | Type | Validation |
|-----------|------|------------|
| `id` | string | Valid UUID |

**Response (200):**

```json
{ "success": true, "data": { "job": { ... } } }
```

**Errors:** `400` invalid UUID, `401` unauthorized, `404` not found

---

## DELETE /jobs/:id

Cancel a pending job or permanently remove a completed/failed job.

- **Auth:** JWT required

**Path Parameters:**
| Parameter | Type | Validation |
|-----------|------|------------|
| `id` | string | Valid UUID |

**Behavior by status:**
| Current Status | Action | Response |
|----------------|--------|----------|
| `pending` | Sets status to `cancelled` | 200 with updated job |
| `completed` | Permanently deletes record | 200 with confirmation message |
| `failed` | Permanently deletes record | 200 with confirmation message |
| `processing` | Rejected | 409 Conflict |
| `cancelled` | Rejected | 409 Conflict |

**Response — pending job cancelled (200):**

```json
{ "success": true, "data": { "job": { ...updatedJob, "status": "cancelled" } } }
```

**Response — completed/failed job deleted (200):**

```json
{ "success": true, "data": { "message": "Job permanently deleted" } }
```

**Errors:** `400` invalid UUID, `401` unauthorized, `404` not found, `409` processing or already cancelled

---

## POST /jobs/:id/retry

Retry a failed job by resetting it back to pending. Resets the worker attempt counter, clears error details, and increments the manual retry counter. The job is placed back in the queue for processing.

- **Auth:** JWT required

**Path Parameters:**
| Parameter | Type | Validation |
|-----------|------|------------|
| `id` | string | Valid UUID |

**Request Body:** None

**Behavior:**
- Only jobs with status `failed` can be retried.
- Sets `status` to `pending` so the worker picks it up again.
- Resets `attempts` to `0` (worker retry budget starts fresh).
- Increments `retries` by `1` (tracks total manual retries).
- Clears `errorMessage`, `result`, and `nextRunAt` (job is immediately eligible for processing).

**Response (200):**

```json
{ "success": true, "data": { "job": { ...updatedJob, "status": "pending", "attempts": 0, "retries": 1 } } }
```

**Errors:** `400` invalid UUID, `401` unauthorized, `404` not found, `409` job not in failed status
