# AGENTS.md

Agent-facing documentation for QueueWizard. **Keep this file updated** on architectural changes.

## Docs Structure

```
AGENTS.md           ← This file (overview)
docs/ARCH.md        ← Architecture details
docs/ENDPOINTS.md   ← API endpoint reference
docs/TYPESCRIPT.md  ← Strict TS guidelines
docs/TESTING.md     ← Test strategy
docs/ADR/           ← Decision records
```

Update `docs/` for detailed changes. Create ADRs for significant decisions per `docs/ADR/README.md`.

### Dates

**Don't assume current year** (training cutoff issue). Run `date "+%Y-%m-%d"` if date unknown.

---

## Project Overview

**QueueWizard**: REST API for HTTP job queues. Node.js + Express 5 + TypeScript + Prisma/SQLite
(better-sqlite3) + Zod validation + JWT auth (bcrypt hashed passwords).

## Structure

| Path              | Purpose                              |
| ----------------- | ------------------------------------ |
| `src/lib/`        | Config, DB, errors, JWT, Zod schemas |
| `src/middleware/` | Auth, error handler                  |
| `src/routes/`     | auth.ts, jobs.ts                     |
| `src/generated/`  | Prisma client (**never edit**)       |
| `prisma/`         | Schema + SQLite DB                   |
| `docs/`           | Architecture docs                    |
| `dist/`           | Build output                         |

## Commands

```bash
npm install                  # Install deps
npm run prisma:generate      # Gen Prisma client (after schema change)
npm run prisma:push          # Sync schema to DB (dev)
npm run prisma:migrate       # Run migrations (prod)
npm run dev                  # Dev server with hot reload (:3000)
npm run build                # Compile to dist/
npm run start                # Run production build
npm run typecheck            # Type check
npm run lint                 # Run ESLint (run on code changes)
npm run lint:fix             # Run ESLint with auto-fix
npm run format               # Format all files with Prettier
npm run format:check         # Check if files are formatted
npm test                     # Run tests
npm run test:coverage        # Run tests with coverage
```

### Pre-commit Hooks (Lefthook)

Pre-commit hooks run automatically on `git commit`:

1. **format** — Prettier formats staged files and re-stages them
2. **lint** — ESLint fixes staged files and re-stages them
3. **typecheck** — TypeScript type checking

## Code Style

- **TypeScript strict mode**, ESM (`"type": "module"`), `.js` imports
- **Never use `any`** → use `unknown` + Zod
- Explicit return types on exports
- **Conventional Commits** for all commit messages (e.g., `feat:`, `fix:`, `docs:`, `chore:`)
- See [docs/TYPESCRIPT.md](./docs/TYPESCRIPT.md)

| Element | Convention      | Example           |
| ------- | --------------- | ----------------- |
| Files   | camelCase       | `errorHandler.ts` |
| Classes | PascalCase      | `AppError`        |
| Schemas | camelCaseSchema | `createJobSchema` |

**Response format:**

```json
{"success": true, "data": {...}}
{"success": false, "error": {"message": "...", "details?": [...]}}
```

## Architecture

|            |                                  |
| ---------- | -------------------------------- |
| Runtime    | Node.js, TS (ES2022/NodeNext)    |
| Framework  | Express 5                        |
| DB         | SQLite + Prisma + better-sqlite3 |
| Auth       | JWT (24h) + bcrypt               |
| Validation | Zod                              |

**Models:** User (email/password, owns jobs), Job (method, url, headers, body, status, priority)

**Routes:**

| Endpoint            | Auth | Description    |
| ------------------- | ---- | -------------- |
| `GET /health`       | No   | Health check   |
| `POST /auth/signup` | No   | Create account |
| `POST /auth/signin` | No   | Get JWT        |
| `POST /jobs`        | JWT  | Create job     |
| `GET /jobs`         | JWT  | List jobs      |
| `GET /jobs/:id`     | JWT  | Get job        |

Details: [docs/ARCH.md](./docs/ARCH.md)

## Security

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-in-production"
PORT=3000
```

- Never commit `.env`
- bcrypt: 10 rounds
- JWT: 24h expiry
- User data scoped by `userId`

## Agent Guardrails

**Never auto-modify:**

- `prisma/schema.prisma`, `src/generated/**`, `*.lock`, `.env*`, `prisma/dev.db`

**Requires human review:**

- DB migrations
- Auth logic (`src/routes/auth.ts`, `src/middleware/auth.ts`, `src/lib/jwt.ts`)
- Dependency changes

**Boundaries:**

- `npm install` once per task max
- Run `npm test` after code changes to ensure tests pass
- No new top-level dirs without approval
- Always validate with Zod
- No raw SQL without justification
- Filter queries by `userId`

## Extensibility

**Env vars:** `PORT` (3000), `JWT_SECRET`, `DATABASE_URL` (file:./dev.db)

**Add route:**

1. Create `src/routes/<name>.ts`
2. Add schemas to `src/lib/schemas.ts`
3. Register in `src/index.ts`: `app.use("/<name>", routes)`
4. Add `authMiddleware` if protected
5. Update `docs/ENDPOINTS.md` with new endpoint details

**Add error:** Extend `AppError` in `src/lib/errors.ts`

**Schema change:**

1. Edit `prisma/schema.prisma`
2. `npm run prisma:push` (dev) or `prisma:migrate` (prod)
3. `npm run prisma:generate`

## Links

- [docs/ARCH.md](./docs/ARCH.md) — Architecture
- [docs/ENDPOINTS.md](./docs/ENDPOINTS.md) — API endpoints
- [docs/TYPESCRIPT.md](./docs/TYPESCRIPT.md) — TS guidelines
- [docs/TESTING.md](./docs/TESTING.md) — Testing
- [docs/ADR/](./docs/ADR/) — Decisions
- [prisma/schema.prisma](./prisma/schema.prisma) — DB schema
- [src/lib/schemas.ts](./src/lib/schemas.ts) — Zod schemas
