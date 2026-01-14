# Testing Strategy

This document outlines the testing strategy and recommendations for the QueueWizard project.

> **Status:** Testing infrastructure is planned but not yet implemented.

---

## Overview

QueueWizard should implement a comprehensive testing strategy covering:

1. **Unit Tests** — Individual functions and utilities
2. **Integration Tests** — API endpoints with database
3. **E2E Tests** — Full user workflows (optional)

---

## Recommended Tools

| Tool         | Purpose                        | Status      |
|--------------|--------------------------------|-------------|
| Vitest       | Test runner and assertions     | Recommended |
| Supertest    | HTTP endpoint testing          | Recommended |
| @faker-js/faker | Test data generation        | Optional    |

### Installation

```bash
npm install -D vitest supertest @types/supertest @faker-js/faker
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Test Structure

```
src/
├── __tests__/
│   ├── setup.ts              # Test setup and helpers
│   ├── integration/
│   │   ├── auth.test.ts      # Auth endpoints
│   │   └── jobs.test.ts      # Jobs endpoints
│   └── unit/
│       ├── jwt.test.ts       # JWT utilities
│       ├── schemas.test.ts   # Zod schema validation
│       └── errors.test.ts    # Error classes
```

---

## Unit Test Examples

### JWT Utilities

```typescript
// src/__tests__/unit/jwt.test.ts
import { describe, it, expect } from "vitest";
import { generateToken, verifyToken } from "../../lib/jwt.js";

describe("JWT utilities", () => {
  const userId = "test-user-id";

  it("should generate a valid token", () => {
    const token = generateToken(userId);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
  });

  it("should verify and decode token", () => {
    const token = generateToken(userId);
    const payload = verifyToken(token);
    expect(payload.userId).toBe(userId);
  });

  it("should throw on invalid token", () => {
    expect(() => verifyToken("invalid-token")).toThrow();
  });
});
```

### Zod Schemas

```typescript
// src/__tests__/unit/schemas.test.ts
import { describe, it, expect } from "vitest";
import { createJobSchema, signupSchema } from "../../lib/schemas.js";

describe("createJobSchema", () => {
  it("should accept valid job data", () => {
    const result = createJobSchema.parse({
      method: "GET",
      url: "https://example.com/api",
      headers: "{}",
    });
    expect(result.method).toBe("GET");
    expect(result.priority).toBe(0);  // default
  });

  it("should reject invalid HTTP method", () => {
    expect(() =>
      createJobSchema.parse({
        method: "INVALID",
        url: "https://example.com",
      })
    ).toThrow();
  });

  it("should reject invalid URL", () => {
    expect(() =>
      createJobSchema.parse({
        method: "GET",
        url: "not-a-url",
      })
    ).toThrow();
  });
});
```

---

## Integration Test Examples

### Test Setup

```typescript
// src/__tests__/setup.ts
import { prisma } from "../lib/db.js";
import { beforeEach, afterAll } from "vitest";

// Clean database before each test
beforeEach(async () => {
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Helper to create test user
export async function createTestUser() {
  return prisma.user.create({
    data: {
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
      password: "$2b$10$hashedpassword",  // Pre-hashed for tests
    },
  });
}
```

### Auth Endpoint Tests

```typescript
// src/__tests__/integration/auth.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../index.js";  // Export app from index.ts

describe("POST /auth/signup", () => {
  it("should create a new user", async () => {
    const response = await request(app)
      .post("/auth/signup")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("test@example.com");
  });

  it("should reject duplicate email", async () => {
    // First signup
    await request(app)
      .post("/auth/signup")
      .send({
        name: "User 1",
        email: "duplicate@example.com",
        password: "password123",
      });

    // Second signup with same email
    const response = await request(app)
      .post("/auth/signup")
      .send({
        name: "User 2",
        email: "duplicate@example.com",
        password: "password456",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });
});
```

### Jobs Endpoint Tests

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
    const response = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        method: "GET",
        url: "https://api.example.com/data",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.job.method).toBe("GET");
    expect(response.body.data.job.status).toBe("pending");
  });

  it("should reject without auth", async () => {
    const response = await request(app)
      .post("/jobs")
      .send({
        method: "GET",
        url: "https://api.example.com/data",
      });

    expect(response.status).toBe(401);
  });
});
```

---

## Coverage Requirements

| Metric      | Target  |
|-------------|---------|
| Statements  | > 80%   |
| Branches    | > 75%   |
| Functions   | > 80%   |
| Lines       | > 80%   |

### Vitest Coverage Config

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "src/generated/",
        "**/*.d.ts",
      ],
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

## Implementation Roadmap

1. [ ] Install testing dependencies
2. [ ] Create test setup file with database helpers
3. [ ] Export Express app for testing
4. [ ] Write unit tests for `lib/` utilities
5. [ ] Write integration tests for auth endpoints
6. [ ] Write integration tests for jobs endpoints
7. [ ] Set up coverage reporting
8. [ ] Add tests to CI pipeline
