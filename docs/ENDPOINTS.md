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

## GET /jobs

List authenticated user's jobs.

- **Auth:** JWT required

**Query Parameters:**
| Parameter | Type | Required | Values |
|-----------|------|----------|--------|
| `status` | string | No | `pending`, `processing`, `completed`, `failed` |

**Response (200):**

```json
{ "success": true, "data": { "jobs": [...], "count": 1 } }
```

Jobs ordered by priority (asc), then createdAt (desc).

**Errors:** `400` invalid status, `401` unauthorized

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
