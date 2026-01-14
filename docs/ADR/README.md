# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the QueueWizard project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its
context and consequences. ADRs help teams understand why certain decisions were made.

## Format

Each ADR should follow this template:

```markdown
# ADR-NNNN: Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

## Date
YYYY-MM-DD (use `date "+%Y-%m-%d"` if current date unknown)

## Context
What is the issue that we're seeing that is motivating this decision or change?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?
```

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](./0001-use-better-sqlite3-driver.md) | Use better-sqlite3 Driver for Prisma | Accepted | 2026-01-14 |
| [0002](./0002-zod-validation-all-inputs.md) | Zod Validation for All External Inputs | Accepted | 2026-01-14 |
| [0003](./0003-jwt-authentication.md) | JWT-based Authentication | Accepted | 2026-01-14 |

## Creating a New ADR

1. Copy the template above
2. Name the file `NNNN-short-title.md` (use next available number)
3. Fill in all sections
4. Add entry to the index table above
5. Update AGENTS.md if the decision affects agent behavior
