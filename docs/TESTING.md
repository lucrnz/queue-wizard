# Testing Strategy

This document outlines the testing strategy for the QueueWizard project.

> **Status:** ✅ Implemented

---

## Overview

QueueWizard implements a comprehensive testing strategy covering:

1. **Unit Tests** — Individual functions and utilities
2. **Integration Tests** — API endpoints with database
3. **End-to-End (E2E) Tests** — Full server + real HTTP + ephemeral DB

---

## Tools

| Tool                | Purpose                            |
| ------------------- | ---------------------------------- |
| Vitest              | Test runner and assertions         |
| Supertest           | Integration endpoint testing       |
| Native fetch        | E2E HTTP requests (Node.js runtime) |
| @faker-js/faker     | Test data generation               |
| @vitest/coverage-v8 | Code coverage reporting            |

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run end-to-end tests
npm run test:e2e
```

---

## Test Structure

```
src/
├── __tests__/
│   ├── setup.ts              # Test setup and helpers
│   ├── e2e/
│   │   └── api.test.ts       # Full server E2E flow
│   ├── integration/
│   │   ├── auth.test.ts      # Auth endpoints
│   │   ├── health.test.ts    # Health check endpoint
│   │   └── jobs.test.ts      # Jobs endpoints
│   └── unit/
│       ├── errors.test.ts    # Error classes
│       ├── jwt.test.ts       # JWT utilities
│       └── schemas.test.ts   # Zod schema validation
```

---

## Test Setup

### Unit & Integration Setup

The test setup file (`src/__tests__/setup.ts`) provides:

- **Database cleanup** before each test via `beforeEach`
- **Prisma disconnection** after all tests via `afterAll`
- **Helper functions** for creating test users and jobs

```typescript
import { createTestUser, createTestJob, TEST_USER_PASSWORD } from "../setup.js";

// Create a test user with default password
const user = await createTestUser();

// Create a test user with custom data
const user = await createTestUser({
  email: "custom@example.com",
  name: "Custom User",
});

// Create a test job for a user
const job = await createTestJob(userId, {
  method: "POST",
  url: "https://api.example.com/test",
});
```

### End-to-End Setup

E2E tests boot a real HTTP server and use an ephemeral Prisma SQLite database.
Each run:

1. Creates a temp DB file and sets `DATABASE_URL`.
2. Runs `prisma db push` against the temp DB.
3. Starts the Express server on an ephemeral port.
4. Executes the full API flow via native `fetch`.
5. Closes the server and deletes the temp DB.

---

## Writing Tests

### Unit Tests

Unit tests are located in `src/__tests__/unit/` and test individual functions:

```typescript
// src/__tests__/unit/jwt.test.ts
import { describe, it, expect } from "vitest";
import { generateToken, verifyToken } from "../../lib/jwt.js";

describe("JWT utilities", () => {
  it("should generate a valid token string", () => {
    const token = generateToken("user-id");
    expect(token).toBeDefined();
    expect(token.split(".")).toHaveLength(3);
  });

  it("should verify and decode a valid token", () => {
    const token = generateToken("user-id");
    const payload = verifyToken(token);
    expect(payload.userId).toBe("user-id");
  });
});
```

### Integration Tests

Integration tests are located in `src/__tests__/integration/` and test API endpoints:

```typescript
// src/__tests__/integration/jobs.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../index.js";
import { generateToken } from "../../lib/jwt.js";
import { createTestUser } from "../setup.js";

describe("POST /jobs", () => {
  let token: string;

  beforeEach(async () => {
    const user = await createTestUser();
    token = generateToken(user.id);
  });

  it("should create a job", async () => {
    const response = await request(app).post("/jobs").set("Authorization", `Bearer ${token}`).send({
      method: "GET",
      url: "https://api.example.com/data",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.job.status).toBe("pending");
  });

  it("should reject without auth", async () => {
    const response = await request(app)
      .post("/jobs")
      .send({ method: "GET", url: "https://example.com" });

    expect(response.status).toBe(401);
  });
});
```

### End-to-End Tests

End-to-end tests live in `src/__tests__/e2e/` and run against a real HTTP server
with a temporary Prisma SQLite database. The flow spins up the app on an ephemeral
port, pushes the Prisma schema to a fresh temp DB, runs the full API workflow, and
removes the DB file once the suite completes.

Run E2E tests with:

```bash
npm run test:e2e
```

The E2E tests use native `fetch` (Node.js built-in) to ensure we exercise the
same runtime HTTP stack as production.

---

## Coverage Requirements

| Metric     | Target | Current |
| ---------- | ------ | ------- |
| Statements | > 80%  | ~90%    |
| Branches   | > 75%  | ~82%    |
| Functions  | > 80%  | ~89%    |
| Lines      | > 80%  | ~90%    |

Coverage excludes:

- `node_modules/`, `dist/`
- `src/generated/` (Prisma client)
- `src/__tests__/` (test files themselves)
- `src/index.ts` (server bootstrap)
- Type definition files (`*.d.ts`)

---

## Configuration

The test configuration is in `vitest.config.ts` (unit/integration) and `vitest.e2e.config.ts` (end-to-end):

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    fileParallelism: false, // Sequential execution for database tests
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### Key Configuration Notes

- **`fileParallelism: false`**: Tests run sequentially to avoid database conflicts
- **`setupFiles`**: Global setup runs before each test file
- **`globals: true`**: Vitest globals (`describe`, `it`, `expect`) available without imports

---

## CI Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run prisma:generate
      - run: npm run prisma:push
      - run: npm test
      - run: npm run test:coverage
```

---

## Implementation Status

- [x] Install testing dependencies
- [x] Create test setup file with database helpers
- [x] Export Express app for testing
- [x] Write unit tests for `lib/` utilities
- [x] Write integration tests for health endpoint
- [x] Write integration tests for auth endpoints
- [x] Write integration tests for jobs endpoints
- [x] Set up coverage reporting with thresholds
- [ ] Add tests to CI pipeline (GitHub Actions)
