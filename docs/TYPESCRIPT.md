# TypeScript Coding Guidelines

This document defines the TypeScript coding standards for the QueueWizard project.

## Compiler Configuration

The project uses strict TypeScript settings. See `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## Core Rules

### 1. Never Use `any`

**The `any` type is prohibited.** Use `unknown` with proper type narrowing instead.

```typescript
// ❌ WRONG
function processData(data: any): void {
  console.log(data.value);
}

// ✅ CORRECT
function processData(data: unknown): void {
  const validated = someSchema.parse(data);
  console.log(validated.value);
}
```

### 2. Use Explicit Return Types

All exported functions must have explicit return types.

```typescript
// ❌ WRONG
export function getUser(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

// ✅ CORRECT
export function getUser(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}
```

### 3. Prefer `readonly`

Use `readonly` modifiers for properties that shouldn't be mutated.

```typescript
// ❌ WRONG
interface Config {
  port: number;
  secret: string;
}

// ✅ CORRECT
interface Config {
  readonly port: number;
  readonly secret: string;
}

// Or use const assertion
export const config = {
  port: 3000,
  secret: "xxx",
} as const;
```

### 4. Use `as const` for Constants

```typescript
// ❌ WRONG
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
// Type: string[]

// ✅ CORRECT
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
// Type: readonly ["GET", "POST", "PUT", "PATCH", "DELETE"]
```

---

## Zod Schema Patterns

### Define Schemas with Type Inference

```typescript
import { z } from "zod";

// Define schema
export const createJobSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().url("Invalid URL"),
  headers: z.string().default("{}"),
  body: z.string().nullable().default(null),
  priority: z.number().int().default(0),
});

// Infer type from schema
export type CreateJobInput = z.infer<typeof createJobSchema>;
```

### Validate All External Input

```typescript
// Route handlers
router.post("/", async (req, res, next) => {
  try {
    // Always validate request body
    const validated = createJobSchema.parse(req.body);
    // Use validated data...
  } catch (error) {
    next(error); // ZodError caught by error handler
  }
});
```

### Custom Refinements

```typescript
// JSON string validation
export const headersSchema = z.string().refine(
  (val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Must be valid JSON string" }
);
```

---

## Error Handling Patterns

### Typed Error Classes

```typescript
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}
```

### Error Handler Typing

```typescript
import { Request, Response, NextFunction } from "express";
import { ZodError, ZodIssue } from "zod";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Type-safe error handling
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: "Validation error",
        details: err.issues.map((issue: ZodIssue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }
  // ...
}
```

---

## Naming Conventions

| Element       | Convention      | Example                           |
| ------------- | --------------- | --------------------------------- |
| Files         | camelCase       | `errorHandler.ts`, `db.ts`        |
| Interfaces    | PascalCase      | `JwtPayload`, `ErrorResponse`     |
| Type aliases  | PascalCase      | `CreateJobInput`, `HttpMethod`    |
| Classes       | PascalCase      | `AppError`, `NotFoundError`       |
| Functions     | camelCase       | `generateToken`, `verifyToken`    |
| Constants     | camelCase/UPPER | `config`, `HTTP_METHODS`          |
| Zod schemas   | camelCaseSchema | `signupSchema`, `createJobSchema` |
| Env variables | SCREAMING_SNAKE | `JWT_SECRET`, `DATABASE_URL`      |

---

## Import Organization

Order imports consistently:

```typescript
// 1. Node.js built-ins
import path from "path";
import { fileURLToPath } from "url";

// 2. External packages
import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";

// 3. Internal modules (absolute paths with .js extension)
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import { AppError } from "../lib/errors.js";

// 4. Types (if separate)
import type { User } from "../generated/prisma/client.js";
```

---

## ESM Module Requirements

This project uses ES Modules (`"type": "module"` in package.json).

### Always Use `.js` Extensions

```typescript
// ❌ WRONG
import { config } from "./config";
import { prisma } from "../lib/db";

// ✅ CORRECT
import { config } from "./config.js";
import { prisma } from "../lib/db.js";
```

### `__dirname` Replacement

```typescript
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```
