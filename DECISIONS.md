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

---

## D5. Database schema

- **Natural keys from the source data** (`C0001`, `A00001`, `T0000001`…) are
  the primary keys, with a CHECK on their format. They are stable, meaningful
  to users, and what the CSVs reference, so no surrogate-key mapping is needed.
- **Enumerations as `TEXT` + `CHECK`**, not PostgreSQL `ENUM` types: the
  allowed values are visible in the table definition, and changing them is a
  constraint swap rather than an `ALTER TYPE`.
- **Exact numerics:** money `NUMERIC(18,2)`, prices/costs `NUMERIC(18,4)`,
  quantities `NUMERIC(18,6)`. The API returns them as strings so no value
  passes through a floating-point number.
- **Dates as `DATE`, returned as `YYYY-MM-DD` strings.** A calendar date has no
  time zone; converting it to a JS `Date` can shift it by a day.
- **Constraints encode business rules** as a last line of defence behind API
  validation: `amount > 0` (direction comes from `transaction_type`), trade
  vs cash-event shape (`BUY/SELL` need quantity and price, `DIVIDEND/FEE` have
  neither), `date_of_birth < onboarded_at`, sector only on equities,
  case-insensitive unique email.
- **Risk profiles keep history** (`PRIMARY KEY (customer_id, assessed_at)`);
  "latest" is the `v_latest_risk_profile` view. The CSV has one per customer,
  but reassessments are normal and should not overwrite the past.
- **Goal IDs** for goals created in the app come from `goal_id_seq`
  (`G00178`, …); the import moves the sequence past imported IDs.
- **Indexes follow query patterns only:** `accounts(customer_id)`;
  `transactions(account_id, trade_date DESC, transaction_id DESC)` serves the
  filtered, sorted, paginated transaction list (see `docs/sql-tasks.md` for
  the `EXPLAIN`); `transactions(instrument_id)` for the instrument filter;
  a partial index on non-settled transactions; `holdings(instrument_id)` for
  holder counts; `goals(customer_id)`.
- **Aggregation lives in views**: `v_positions` (the single definition of
  market value and unrealised P/L), `v_account_valuation`,
  `v_customer_portfolio`, `v_asset_allocation`, `v_monthly_net_flows`,
  `v_goal_status` (funded %, overdue/over-funded/under-funded/name-type flags),
  `v_data_quality_exceptions`.
- **Portfolio uses the latest snapshot date in the table.** The supplied data
  has one snapshot (2026-09-18). With several snapshots and accounts reported
  on different days, this would become "latest snapshot per account".
- **Migrations** are plain SQL run by dbmate, each with an `up` and a `down`
  section. dbmate runs each migration in a transaction, so a failing migration
  leaves the schema unchanged; `pnpm db:rollback` reverts the latest one.
  All three migrations were verified to roll back to an empty schema.

## D6. Import pipeline (seed and admin upload share it)

- **One generic pipeline** (`apps/api/src/imports/import-service.ts`) driven
  by per-dataset definitions (`datasets.ts`: columns, row schema, key,
  references). The seed runs every CSV through it, so seed data gets exactly
  the validation the admin upload will.
- **Idempotency by content:** each batch stores the file's SHA-256 with
  `UNIQUE (dataset, file_sha256)`. Re-importing the same bytes (even under a
  different file name) returns `ALREADY_IMPORTED` and changes nothing.
- **Never silently overwrite:** a key that already exists in the table is
  rejected as `ALREADY_EXISTS`. Corrections would need an explicit, audited
  rule; that is out of scope.
- **In-file duplicates:** exact copies keep the first occurrence and reject the
  others (`DUPLICATE_ROW`); copies with different values reject every copy
  (`CONFLICTING_DUPLICATE`), since there is no safe way to choose one.
- **Reject, don't correct.** The negative fee is rejected, not sign-flipped:
  it could be a refund, and guessing would put unverifiable data in the ledger.
- **Future dates** (after the import date) are rejected as `FUTURE_DATE`.
- **Stage → validate → merge in one transaction.** Rows passing format checks
  go into a temporary staging table shaped like the target; foreign keys and
  existing keys are checked set-based in SQL; the rest is merged with one
  `INSERT … SELECT`. Batch record, rejects and data commit together or not at
  all. A per-dataset advisory lock serialises concurrent imports.
- **Whole-file errors** (not CSV, wrong header, empty) fail before anything is
  written; row-level problems never fail the file.
- **Rejected rows are quarantined** in `import_rejects` with every reason
  (`reasons` JSONB), the primary reason code, and the original row, so they can
  be inspected and re-submitted.
- **Soft anomalies are imported and reported, not rejected**: trades before an
  account's open date (1,069) and activity on closed accounts appear in
  `v_data_quality_exceptions`. Rejecting them would discard ~23% of the ledger.
