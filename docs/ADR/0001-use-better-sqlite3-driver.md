# ADR-0001: Use better-sqlite3 Driver for Prisma

## Status

Accepted

## Date

2026-01-14

## Context

QueueWizard requires a lightweight, embedded database solution suitable for single-server
deployments. The application needs to store user accounts and job queue data with ACID
compliance.

Options considered:

1. **Prisma default SQLite** — Uses Prisma's built-in query engine
2. **better-sqlite3 driver adapter** — Uses synchronous better-sqlite3 via Prisma adapter
3. **PostgreSQL/MySQL** — Full client-server database

## Decision

Use SQLite with the `@prisma/adapter-better-sqlite3` driver adapter.

**Rationale:**

- Zero external dependencies for database server
- Synchronous operations improve predictable performance for queue operations
- Better-sqlite3 is significantly faster than Prisma's default SQLite engine
- Single-file database simplifies deployment and backup
- Prisma 7+ has first-class support for driver adapters

## Consequences

**Positive:**

- Simple deployment (no database server to manage)
- Fast read/write operations
- Easy backup (copy single file)
- No network latency for database operations

**Negative:**

- Not suitable for horizontal scaling (single-writer limitation)
- Limited to single-server deployments
- Database file must be on local filesystem

**Migration path:**
If scaling requirements change, migrate to PostgreSQL by:

1. Updating `prisma/schema.prisma` datasource provider
2. Replacing adapter in `src/lib/db.ts`
3. Running `prisma migrate deploy`
