# Decisions

Assumptions, choices and trade-offs made while building FinPilot. Each entry
records what was decided, why, and what was rejected.

---

## D1. Stack: TypeScript end-to-end

| Layer       | Choice                                                          |
| ----------- | --------------------------------------------------------------- |
| Frontend    | React + Vite, TanStack Query/Table, Recharts, Tailwind          |
| API         | Fastify, Zod (request/response validation → OpenAPI), pino logs |
| Data access | Kysely (typed SQL query builder)                                |
| Migrations  | Plain `.sql` files (dbmate)                                     |
| Database    | PostgreSQL 17 (Docker)                                          |
| Tests       | Vitest                                                          |
| CI          | GitHub Actions                                                  |
| Auth        | JWT in an httpOnly cookie; roles `VIEWER` and `ADMIN`           |

**Why:** one language across API and UI, shared types, and fast iteration for a
12–16 hour timebox. Alternatives considered: Next.js + separate API (two server
runtimes for little gain), FastAPI (viable), Spring Boot (slowest to deliver).

**Why Fastify over Express:**

|                          | Express                   | Fastify                                       |
| ------------------------ | ------------------------- | --------------------------------------------- |
| Released                 | 2010                      | 2016, actively maintained                     |
| Throughput               | baseline                  | roughly 2–3× higher                           |
| Input validation         | add-on                    | built in: each route declares a schema        |
| Swagger / OpenAPI        | hand-written or bolted on | generated from the route schemas              |
| Logging                  | add-on                    | built in (pino), request ID on every log line |
| async/await + TypeScript | partial                   | native                                        |

One Zod schema per route drives request validation (automatic 400s), response
serialisation and the OpenAPI document, so documentation cannot drift from the
code. See [docs/fastify-primer.md](docs/fastify-primer.md).

---

## D2. Database access: plain SQL migrations + Kysely (not Prisma or Drizzle)

|                                                  | Raw SQL (`pg`)    | **Kysely + SQL migrations** (chosen) | Drizzle                   | Prisma                              |
| ------------------------------------------------ | ----------------- | ------------------------------------ | ------------------------- | ----------------------------------- |
| Schema lives in                                  | `.sql` files      | `.sql` files                         | TypeScript                | `schema.prisma`                     |
| CHECK constraints, views, partial indexes        | ✅                | ✅                                   | ⚠️ partial, often raw SQL | ❌ mostly hand-edited raw SQL       |
| Complex aggregations (allocation, monthly flows) | ✅                | ✅ type-safe SQL builder             | ✅ decent                 | ❌ `$queryRaw` for anything serious |
| Type safety                                      | ❌ manual         | ✅                                   | ✅                        | ✅                                  |
| SQL injection safety                             | manual parameters | ✅ automatic                         | ✅                        | ✅                                  |
| Easy to show `EXPLAIN` / explain queries         | ✅                | ✅ reads like SQL                    | 🟡                        | ❌ SQL is hidden                    |

**Why:**

- The data layer carries the most weight in this assessment (constraints,
  CHECKs, indexes, views, `EXPLAIN (ANALYZE, BUFFERS)`, named SQL tasks).
  Plain `.sql` migrations keep that work visible and reviewable.
- Kysely queries read almost 1:1 as SQL, so any query can be traced to the SQL
  it emits.
- Aggregations live in SQL views; Kysely queries them like tables.
- TypeScript types are generated from the migrated database
  (`kysely-codegen`), so the SQL schema is the single source of truth.

**Rejected:**

- _Prisma_ — weak at aggregation-heavy queries and database-level constraints;
  hides the SQL.
- _Drizzle_ — reasonable, but constraints/views frequently drop to raw SQL
  anyway, splitting the schema across TS and SQL.
- _Raw `pg`_ — works, but gives up type safety for no benefit.

See [docs/postgres-primer.md](docs/postgres-primer.md) for what CHECK
constraints, views and partial indexes are and how FinPilot uses them.

---

## D3. Repository and tooling setup

- **pnpm workspaces monorepo** (`apps/api`, `apps/web`, `packages/shared`): one
  install, one lockfile, one CI job; API and web share Zod schemas and types.
- **TypeScript pinned to 6.0.x.** TypeScript 7 is current, but
  `typescript-eslint` supports `<6.1` only. Revisit when it adds TS 7 support.
- **Shared package without a build step in dev.** `@finpilot/shared` exports
  its TypeScript source under a `development` condition (used by Vite, tsx and
  Vitest) and compiled `dist/` otherwise, so the production API runs plain
  JavaScript.
- **PostgreSQL on host port 5433**, bound to `127.0.0.1` only. 5432 is often
  taken by a native install; loopback binding keeps the database off the LAN.
- **Web dev server proxies `/api`** to the API, so the browser sees one origin:
  no CORS in development and auth cookies behave as they will in production.
- **Configuration validated at start-up** with Zod; the API fails fast with a
  readable list of problems rather than failing on first use.
- **Request correlation:** every response carries `x-request-id` (incoming
  header honoured, otherwise a UUID), and it appears in every log line.
- **Log redaction:** `Authorization`, `Cookie` and `Set-Cookie` headers are
  redacted from logs.
- **Health endpoint** returns `200 ok` or `503 degraded` with per-dependency
  status, and never exposes configuration or connection strings.
- **Raw CSVs committed unmodified** under `data/raw/` with `SHA256SUMS`, and
  marked `-text` in `.gitattributes` so Git never rewrites their CRLF endings.

---

## D4. UI components: Base UI behind a wrapper layer

- **Base UI (`@base-ui/react`)** provides unstyled, accessible primitives
  (focus management, ARIA wiring, keyboard support) and is styled with
  Tailwind. Chosen over a pre-styled kit so the look stays ours, and over
  hand-rolled components so accessibility is not re-implemented.
- **Feature code never imports Base UI directly.** Every primitive is wrapped
  once in `apps/web/src/components/ui/` (e.g. `Button`, `Field`) and imported
  from `components/ui`. An ESLint `no-restricted-imports` rule enforces this.
- **Why a wrapper layer:** one place owns styling, defaults (e.g. buttons
  default to `type="button"`) and variants; the rest of the app has a small,
  stable API; and swapping or upgrading the underlying library touches only
  `components/ui/`.
- **Class merging:** Base UI's `className` may be a string or a function of
  component state. `mergeClassName` (`lib/cn.ts`) merges wrapper defaults with
  a caller's className in either form, using `tailwind-merge` so caller
  classes override defaults cleanly.
