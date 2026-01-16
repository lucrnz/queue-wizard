# Architecture Documentation

This document provides detailed architecture documentation for the QueueWizard API.

## Table of Contents

- [Overview](#overview)
- [Repository Structure](#repository-structure)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [API Design](#api-design)
- [Error Handling](#error-handling)
- [Security Model](#security-model)

---

## Overview

QueueWizard is a job queue management API that allows users to create, list, and retrieve HTTP
job definitions. Each job stores complete HTTP request details (method, URL, headers, body) that
can be processed by a separate worker system.

**Key characteristics:**

- RESTful API design
- Stateless authentication via JWT
- Single-tenant user isolation (users only see their own jobs)
- Priority-based job ordering

---

## Repository Structure

```
.
├── prisma/
│   ├── schema.prisma        # Database models (User, Job)
│   └── dev.db               # SQLite database file
├── prisma.config.ts         # Prisma datasource configuration
├── src/
│   ├── index.ts             # Application entry point
│   ├── generated/           # Prisma client (auto-generated)
│   │   └── prisma/
│   ├── lib/                 # Shared utilities
│   │   ├── config.ts        # Environment configuration
│   │   ├── db.ts            # Database client setup
│   │   ├── errors.ts        # Custom error classes
│   │   ├── jwt.ts           # JWT utilities
│   │   └── schemas.ts       # Zod validation schemas
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts          # JWT authentication
│   │   └── errorHandler.ts  # Global error handler
│   ├── routes/              # Route handlers
│   │   ├── auth.ts          # Authentication routes
│   │   └── jobs.ts          # Job management routes
│   └── types/               # TypeScript declarations
│       └── express.d.ts     # Express augmentation
├── dist/                    # Compiled output
├── docs/                    # Documentation
│   ├── ARCH.md              # This file
│   ├── TYPESCRIPT.md        # TypeScript guidelines
│   ├── TESTING.md           # Testing strategy
│   ├── LOGGING.md           # Logging guide
│   └── ADR/                 # Architecture decisions
├── tsconfig.json            # TypeScript configuration
├── package.json             # Dependencies and scripts
└── .env                     # Environment variables
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HTTP Client                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Express Server                               │
│                         (Port 3000)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Middleware Pipeline:                                                │
│  ┌─────────────┐  ┌───────────────┐  ┌─────────────────────────┐    │
│  │ express.json│→ │requestLogger  │→ │ Route Handler           │    │
│  │ (body parse)│  │               │  │                         │    │
│  └─────────────┘  └───────────────┘  └─────────────────────────┘    │
│                         │                     │                    │
│                         └──────────────┬──────┘                    │
│                                        ▼                           │
│                          ┌─────────────────────────┐               │
│                          │ errorHandler            │               │
│                          │ (Zod/AppError/unknown)  │               │
│                          └─────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Auth Routes    │    │   Job Routes     │    │  Health Route    │
│   /auth/*        │    │   /jobs/*        │    │  /health         │
│   (public)       │    │   (protected)    │    │  (public)        │
└──────────────────┘    └──────────────────┘    └──────────────────┘
          │                         │
          │              ┌──────────┴──────────┐
          │              ▼                     │
          │    ┌──────────────────┐            │
          │    │  Auth Middleware │            │
          │    │  (JWT verify)    │            │
          │    │  → req.userId    │            │
          │    └──────────────────┘            │
          │              │                     │
          ▼              ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Zod Validation Layer                           │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │signupSchema │  │createJobSchema │  │ jobQuerySchema           │  │
│  │signinSchema │  │jobIdParamSchema│  │ (status filter)          │  │
│  └─────────────┘  └────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Prisma ORM Layer                               │
│                    (PrismaClient + Adapter)                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SQLite Database                                   │
│                  (better-sqlite3 driver)                             │
│                    prisma/dev.db                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Authentication Flow

```
1. POST /auth/signup
   Client → { name, email, password }
   Server → Validate with signupSchema
         → Hash password with bcrypt
         → Create User in database
         → Return { user }

2. POST /auth/signin
   Client → { email, password }
   Server → Validate with signinSchema
         → Find user by email
         → Compare password with bcrypt
         → Generate JWT token (24h expiry)
         → Return { token, user }
```

### Protected Request Flow

```
1. Client sends request with Authorization: Bearer <token>
2. authMiddleware extracts and verifies token
3. userId attached to req object
4. Route handler accesses req.userId
5. Database queries filtered by userId
6. Response returned to client
```

---

## Database Schema

### User Model

| Column    | Type     | Constraints       |
| --------- | -------- | ----------------- |
| id        | String   | Primary key, UUID |
| name      | String   | Required          |
| email     | String   | Required, Unique  |
| password  | String   | Required (hashed) |
| createdAt | DateTime | Auto-generated    |
| updatedAt | DateTime | Auto-updated      |

### Job Model

| Column       | Type     | Default   | Description                         |
| ------------ | -------- | --------- | ----------------------------------- |
| id           | String   | UUID      | Primary key                         |
| priority     | Int      | 0         | Lower = higher priority             |
| method       | String   | —         | HTTP method                         |
| url          | String   | —         | Target URL                          |
| headers      | String   | "{}"      | JSON string of headers              |
| body         | String?  | null      | JSON string of request body         |
| status       | String   | "pending" | pending/processing/completed/failed |
| attempts     | Int      | 0         | Processing attempt count            |
| result       | String?  | null      | Success response data               |
| errorMessage | String?  | null      | Failure error message               |
| createdAt    | DateTime | now()     | Creation timestamp                  |
| updatedAt    | DateTime | auto      | Last update timestamp               |
| userId       | String   | —         | Foreign key to User                 |

**Indexes:**

- `Job.userId` — Filter jobs by owner
- `Job.status` — Filter jobs by status

---

## API Design

### Response Format

All responses follow a consistent envelope:

```typescript
// Success response
{
  "success": true,
  "data": {
    // Resource-specific data
  }
}

// Error response
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "details": [  // Optional, for validation errors
      { "path": "field.name", "message": "Validation message" }
    ]
  }
}
```

### Endpoints

See [ENDPOINTS.md](./ENDPOINTS.md) for complete endpoint reference.

---

## Error Handling

### Error Classes

| Class               | Status | Usage                            |
| ------------------- | ------ | -------------------------------- |
| ValidationError     | 400    | Invalid input data               |
| AuthenticationError | 401    | Missing/invalid credentials      |
| NotFoundError       | 404    | Resource not found               |
| ConflictError       | 409    | Duplicate resource (e.g., email) |
| AppError            | varies | Base class for custom errors     |

### Error Handler Behavior

1. **ZodError** → 400 with validation details
2. **AppError subclass** → Corresponding status code
3. **Unknown error** → 500 Internal Server Error (logged)

---

## Security Model

### Authentication

- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens signed with HS256 algorithm
- Token expiry: 24 hours
- Token payload: `{ userId: string }`

### Authorization

- All `/jobs/*` routes require valid JWT
- Jobs filtered by `userId` from token
- Users cannot access other users' jobs

### Data Isolation

```typescript
// Jobs are always filtered by authenticated user
const jobs = await prisma.job.findMany({
  where: { userId: req.userId },
});
```
