# How FinPilot was built, feature by feature

A walkthrough in build order. For each feature: **what it does**, **how it
works** (database → API → screen), **where the code is** and **why it was
built that way**.

---

## 0 · The shape of every feature

Every feature follows the same path, so learning one teaches all of them:

```
Screen (React)            apps/web/src/features/<area>/*.tsx
  └─ data hook            apps/web/src/features/<area>/api.ts   (TanStack Query)
      └─ HTTP /api/v1/…   apps/web/src/lib/api.ts               (fetch, same origin, cookie)
          └─ route        apps/api/src/modules/<area>/*.routes.ts     (Zod schemas, status codes)
              └─ service  apps/api/src/modules/<area>/*.service.ts    (business rules, only if any)
                  └─ repo apps/api/src/modules/<area>/*.repository.ts (Kysely SQL → JSON)
                      └─ PostgreSQL tables + views                    db/migrations/*.sql
```

The request and response shapes are Zod schemas in `packages/shared/src/`,
shared by both sides: the API validates with them and generates Swagger from
them; the web app gets TypeScript types and form validation from them.

---

## 1 · Data audit (before any code)

**What:** read all 7 CSVs and find every problem before designing the schema.

**How:** a Python script checked duplicates, foreign keys, enums, dates,
numbers and cross-file consistency. Findings: 7 planted anomalies (duplicate
`T0000026`, unknown instrument `I9999`, negative fee −75, trade dated 2027,
3 duplicate holdings) plus data-generation artefacts (1,069 trades before
the account opened; transactions don't add up to holdings).

**Where:** `docs/data-audit.md`: every anomaly and whether it was rejected,
de-duplicated or reported, and why.

**Why:** the brief grades anomaly handling; knowing the data first decided
the schema (constraints) and the import rules (reject vs report).

---

## 2 · Database schema

**What:** tables for the 7 datasets plus users and import tracking, created
by migrations.

**How:** four plain SQL files run in order by **dbmate**:

| Migration                     | Creates                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `…0100_core_schema.sql`       | customers, accounts, instruments, holdings, transactions, risk_profiles, goals + indexes |
| `…0200_users_and_imports.sql` | users, import_batches, import_rejects                                                    |
| `…0300_reporting_views.sql`   | the calculation views                                                                    |
| `…0400_additive_pnl.sql`      | a fix so cost + P/L = value exactly                                                      |

Rules live in the database: primary/foreign keys, `NOT NULL`, `UNIQUE`,
`CHECK` (e.g. `amount > 0`, BUY/SELL need quantity and price). Money uses
exact `NUMERIC`, never floats. Each migration has an `up` and a `down`.

**Where:** `db/migrations/`; generated TypeScript types in
`apps/api/src/db/schema.ts` (`pnpm db:codegen`).

**Why plain SQL + Kysely instead of Prisma/Drizzle:** constraints, views and
partial indexes are first-class and visible; queries read like SQL
(`DECISIONS.md` D2, `docs/postgres-primer.md`).

**Rollback:** `pnpm db:rollback` reverts one migration using its `down`; CI
rolls all four back to an empty schema and re-applies them on every push.
Applied migrations are never edited, which is why the P/L fix is a new file
(0400).

---

## 3 · CSV import pipeline + seed

**What:** one engine that loads any CSV safely. The seed uses it for all 7
files; the admin upload (feature 12) reuses it.

**How** (`importCsv` in `apps/api/src/imports/import-service.ts`):

1. **Fingerprint** the file (SHA-256). Seen before for this dataset → stop,
   return `ALREADY_IMPORTED`.
2. **Parse** the CSV and check the header (wrong columns → whole file refused).
3. **Validate each row** with a Zod schema per dataset
   (`imports/datasets.ts`): types, enums, real dates, amount rules, future dates.
4. **In-file duplicates:** identical copies → keep first, reject the rest
   (`DUPLICATE_ROW`); copies that differ → reject all (`CONFLICTING_DUPLICATE`).
5. **Stage** valid rows in a temporary table shaped like the real one.
6. **SQL checks on the whole batch:** unknown account/instrument
   (`UNKNOWN_REFERENCE`), ID already in the table (`ALREADY_EXISTS`, never overwrite).
7. **Merge** the survivors with one `INSERT … SELECT`, write the batch record
   and every reject (with reasons and the original row).

Steps 5–7 are **one database transaction** (all or nothing), under an
advisory lock so two uploads of the same dataset can't interleave.

**Where:** `apps/api/src/imports/` (csv.ts, fields.ts, datasets.ts,
import-service.ts); seed: `apps/api/src/seed/seed.ts`; tests:
`apps/api/test/imports/import-service.test.ts`.

**Result on the supplied data:** transactions 4,550 accepted / 4 rejected;
holdings 982 / 3; everything else 100%. Re-running the seed changes nothing.

**Try it:** upload `data/samples/transactions_with_errors.csv` (4 accepted,
13 rejected, one of each rule); the reasons are stored in `import_rejects`.

---

## 4 · Portfolio calculations (views)

**What:** market value, cost, profit/loss, allocation and goal progress,
calculated by PostgreSQL.

**How:** views stack on each other:

```
v_positions            per holding:  value = qty × last_price
                                     cost  = qty × avg_cost
                                     P/L   = value − cost
  └─ v_account_valuation   sum per account (accounts with nothing = 0)
      └─ v_customer_portfolio  sum per customer (the headline number)
v_asset_allocation     value per asset class, weight % via a window function
v_goal_status          funded %, overdue / over-funded / under-funded / name≠type flags
v_latest_risk_profile  newest assessment per customer
v_monthly_net_flows    buys − sells per month (SQL task)
v_data_quality_exceptions  suspicious rows + import rejects
```

**Where:** `db/migrations/…0300_reporting_views.sql` and `…0400`;
explained field by field in `docs/database-guide.md`.

**Why in the database:** one definition of every number (screens can't
disagree), no N+1 queries, and the brief asks for aggregation outside the
browser and at least one useful view.

**Example:** in `v_asset_allocation`,
`sum(sum(market_value)) OVER (PARTITION BY customer_id)` computes each
customer's total in the same pass as the per-class sums.

---

## 5 · API foundation (cross-cutting)

**What:** the Fastify server every endpoint plugs into.

**How** (`apps/api/src/app.ts`):

- **Validation:** every route declares Zod schemas; bad input → `400` with
  field-level `details` before the handler runs.
- **One error shape:** `{ error: { code, message, details?, requestId } }`
  (`plugins/errors.ts`); unexpected errors are logged with the stack, the
  client gets a generic `500`.
- **Logging:** JSON logs (pino), a request ID on every line, returned as the
  `x-request-id` header; cookies and auth headers redacted.
- **Health:** `GET /api/v1/health` → `200 ok` / `503 degraded` with DB status.
- **Swagger:** generated at `/api/docs` from the same schemas.
- **Config:** environment variables validated at start-up (`config.ts`).

**Request path:** request ID assigned → auth check → Zod validation →
service → Kysely query → response validated against its schema → logged with
the same ID.

---

## 6 · Login and roles

**What:** sign in with a demo user; VIEWER vs ADMIN.

**How:**

- **Database:** `users` with scrypt password hashes (`lib/password.ts`),
  created by the seed from `.env` passwords.
- **API:** `POST /auth/login` verifies the password (a dummy hash for unknown
  emails, so timing doesn't reveal which emails exist), then sets a signed
  JWT in an **httpOnly, SameSite=Strict** cookie (`plugins/auth.ts`). Every
  other route runs `authenticate` (401 if no valid cookie); admin routes add
  `requireRole('ADMIN')` (403). Login is rate limited (10/min per IP).
- **Web:** `useSession()` asks `/auth/me` once; `RequireAuth` redirects to
  `/login?next=…` when signed out; any 401 anywhere clears the session
  (`app/query-client.ts`). Sign-out also drops cached customer data, and a
  page restored by the Back button is reloaded so no data shows after sign-out.

**Where:** `apps/api/src/plugins/auth.ts`, `modules/auth/`;
`apps/web/src/features/auth/`.

**Why a cookie, not localStorage:** JavaScript can't read an httpOnly cookie,
so an XSS bug can't steal the session (`DECISIONS.md` D8).

**Known limitation:** a stateless JWT can't be revoked before it expires;
production would use short-lived tokens with refresh, or server-side sessions.

---

## 7 · Customer search

**What:** find a customer by name, ID, email or city; filter; sort; page.

**How:**

- **API:** `GET /customers?q=&kycStatus=&segment=&city=&sort=&page=`
  (`modules/customers/customers.repository.ts`). `q` uses `ILIKE` on name,
  email, city and an ID prefix, with `%`/`_` escaped. Two queries: a count
  (for "1–20 of 120") and the page (`LIMIT/OFFSET`, stable tie-breaker).
- **Web:** `CustomerSearchPage.tsx`. Filters live in the URL
  (`lib/use-url-state.ts`), so refresh and shared links keep them. Active
  filters show as removable pills on their own line (`ActiveFilters`) so the
  bar never shifts. `keepPreviousData` keeps the old page visible while the
  next loads. Clicking anywhere in a row opens the customer; the name stays a
  real link for keyboard and cmd-click.

**Why server-side:** filtering and pagination happen in PostgreSQL; the
browser only ever holds one page.

---

## 8 · Customer profile and risk

**What:** the header on every customer tab: details, KYC, segment, latest risk.

**How:** `GET /customers/:id` joins `customers` with `v_latest_risk_profile`;
`riskProfile` is `null` when none exists (the UI says "No risk assessment on
file"). Unknown ID → `404`; malformed ID → `400`.

**Where:** `modules/customers/`; `apps/web/src/features/customer/CustomerLayout.tsx`.

---

## 9 · Portfolio overview

**What:** value, gain/loss, freshness dates, allocation chart, account cards,
goals needing attention.

**How:**

- **API:** `GET /customers/:id/portfolio` runs **four queries in parallel**
  (totals, accounts, allocation, positions) against the views, whatever the
  number of accounts: no N+1 (`modules/portfolio/portfolio.repository.ts`).
  Money travels as decimal strings (`"1953574.61"`).
- **Web:** `OverviewPage.tsx` formats only (Indian grouping, ₹19.54 L). The
  donut (Recharts) is decorative for screen readers; the table next to it
  carries the same numbers. Chart code is lazy-loaded with this page only.

**Verification:** the book total was cross-checked against an independent
calculation from the raw CSVs, and tests assert cost + P/L = value at every
level.

---

## 10 · Positions

**What:** every holding with quantity, average cost, price, value, P/L.

**How:** the same portfolio response (already cached). A customer has at most
a few dozen positions, so the account filter and column sorting run in the
browser; every value still comes from `v_positions`.

**Where:** `apps/web/src/features/customer/PositionsPage.tsx`.

---

## 11 · Transactions

**What:** history with date/account/instrument/type/status filters, sorting,
pagination; pending and reversed stand out.

**How:**

- **API:** `GET /customers/:id/transactions` joins through
  `accounts.customer_id`, so asking for another customer's account returns
  nothing. Filters become `WHERE` clauses; the composite index
  `(account_id, trade_date DESC, transaction_id DESC)` serves it
  (`EXPLAIN` in `docs/sql-tasks.md`: 0.09 ms).
- **Web:** `TransactionsPage.tsx`; filters in the URL with pills; an inverted
  date range is caught before any request.

---

## 12 · Goals: create and edit

**What:** goal cards with funded % and warnings; create and edit with validation.

**How:**

- **API:** `GET/POST /customers/:id/goals`, `PATCH /goals/:id`. Zod checks
  types and ranges (400); `goals.service.ts` adds business rules: a target
  date can't be _set_ in the past (422); over-funding is allowed but
  flagged. New IDs come from a sequence. Changes are logged with the user.
- **Web:** `GoalDialog.tsx` validates with **the same shared schema** before
  sending, shows server errors under the right field, and PATCHes **only the
  fields that changed**. The list refreshes and a toast confirms.

**Where:** `modules/goals/`; `apps/web/src/features/goals/`; the goal-update
sequence diagram is in the architecture report (§6.3).

---

## 13 · Admin CSV import screen

**What:** upload a transactions file, see accepted/rejected counts and a
reason for every rejected row, download rejects, see history.

**How:**

- **API:** `POST /admin/imports/transactions` takes the file as a `text/csv`
  body (5 MB limit) and calls the same `importCsv` as the seed. `201` new,
  `200 ALREADY_IMPORTED`, `422` wrong header, `403` for viewers. History:
  `GET /admin/imports`; rejects: `GET /admin/imports/:id/rejects`.
- **Web:** `features/admin/ImportPage.tsx`: file checks before upload,
  progress bar, results, rejects table with the original row, CSV download,
  history with a dialog per batch. Route and menu are admin-only.

**Duplicate loads** are stopped by the file fingerprint (unique per dataset)
and the primary key on `transaction_id`.

---

## 14 · UI system

**What:** consistent, accessible components in Recollect's style.

**How:** Base UI (unstyled, accessible primitives) wrapped once in
`apps/web/src/components/ui/`; an ESLint rule blocks importing Base UI
anywhere else. Styling is Tailwind only: `src/index.css` holds just the
`@theme` tokens (Recollect's grays, `text-13`, `font-450`, shadows) and the
Inter font. No `useEffect` anywhere: server data via TanStack Query, derived
values computed during render.

**Why:** accessibility (labels, focus, keyboard) comes from Base UI; one
place owns the look (`DECISIONS.md` D4, D10).

---

## 15 · Tests

- **API (53):** real PostgreSQL, recreated from migrations every run
  (`test/global-setup.ts`): import rules on the real CSVs, auth (cookie
  flags, same 401 for wrong password/unknown email), search, portfolio maths,
  transaction scoping, goals (400/422/404, PATCH), admin import (403,
  201/200, rejects).
- **Web (9):** formatting, goal form (all errors at once, server errors under
  fields, PATCH sends only changed fields), rejects CSV export.

`pnpm test` runs both.

---

## 16 · Docker: one command

`docker compose up --build` starts **db → migrate (migrations + seed, then
exits) → api → web**, each waiting for the previous one to be healthy. nginx
serves the site with security headers and passes `/api` to the API (not
published on the host). `scripts/smoke-test.sh` checks the running stack
end to end.

**Where:** `docker-compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`,
`apps/web/nginx/` (`DECISIONS.md` D12).

---

## 17 · CI/CD

GitHub Actions on every push and pull request (`.github/workflows/ci.yml`):

1. **build-and-test:** install → format → lint → typecheck → dependency audit
   → migrations up/rollback/up → generated types up to date → tests → build.
2. **docker-stack:** build images → start stack → smoke test → restart is a no-op.

Evidence: PR #1 changed one expected value by a paisa and the pipeline went red.

---

## 18 · Documentation

`README.md` (setup, demo users, reviewer guide), `DECISIONS.md` (D1–D12 +
assumptions/limitations), `docs/architecture-report.pdf` (10 required
sections, 9 diagrams), `docs/data-audit.md`, `docs/sql-tasks.md`,
`docs/database-guide.md`, `docs/diagrams/` (Mermaid sources).
