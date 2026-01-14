# ADR-0002: Zod Validation for All External Inputs

## Status

Accepted

## Date

2026-01-14

## Context

The API accepts user input from HTTP requests (body, query params, path params). We need a
robust validation strategy that:

- Provides runtime type safety
- Generates TypeScript types from validation schemas
- Gives clear error messages to clients
- Integrates well with Express middleware

Options considered:

1. **Manual validation** — Custom validation functions
2. **Joi** — Popular schema validation library
3. **Zod** — TypeScript-first schema validation
4. **class-validator** — Decorator-based validation

## Decision

Use Zod for all external input validation.

**Implementation:**

- All schemas defined in `src/lib/schemas.ts`
- Schema names follow pattern: `<action><Entity>Schema` (e.g., `createJobSchema`)
- Export inferred types alongside schemas (e.g., `type CreateJobInput`)
- Validation errors caught by global error handler

## Consequences

**Positive:**

- Single source of truth for validation rules and TypeScript types
- `z.infer<typeof schema>` eliminates type drift
- Composable schemas for complex validation
- Built-in refinements for custom validation (JSON string validation)
- Excellent TypeScript integration

**Negative:**

- Additional dependency (~50KB)
- Learning curve for advanced features (transforms, refinements)
- Different API than other validation libraries team may know

**Patterns established:**

```typescript
// Schema definition
export const createJobSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().url(),
  // ...
});

// Type inference
export type CreateJobInput = z.infer<typeof createJobSchema>;

// Usage in route handler
const validated = createJobSchema.parse(req.body);
```
