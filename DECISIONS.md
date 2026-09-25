# Decisions

Assumptions, choices and trade-offs made while building FinPilot. Each entry
records what was decided, why, and what was rejected.

---

## D1. Stack: TypeScript end-to-end

| Layer       | Choice                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| Frontend    | React + Vite, TanStack Query, React Router, Recharts, Tailwind, Base UI |
| API         | Fastify, Zod (request/response validation → OpenAPI), pino logs         |
| Data access | Kysely (typed SQL query builder)                                        |
| Migrations  | Plain `.sql` files (dbmate)                                             |
| Database    | PostgreSQL 17 (Docker)                                                  |
| Tests       | Vitest                                                                  |
| CI          | GitHub Actions                                                          |
| Auth        | JWT in an httpOnly cookie; roles `VIEWER` and `ADMIN`                   |

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
- **What the admin uploads:** all seven CSVs are loaded once by the seed as
  the starting state. The admin screen imports **daily transaction files**
  (the brief's preferred example), same columns as `transactions.csv`. The
  pipeline supports every dataset, so a holdings upload is a small extension.
  Demo sample files (a clean daily file and one with mixed errors) will live
  in `data/samples/`; re-uploading the original `transactions.csv`
  demonstrates idempotency ("already imported").

---

## D7. API design

- **Layers:** `routes` (HTTP only: schemas, status codes, logging) →
  `service` (business rules, where there are any, e.g. goals) →
  `repository` (Kysely queries, row → DTO mapping). Modules live in
  `apps/api/src/modules/<area>/`. Read-only areas skip the service layer
  rather than adding a pass-through file.
- **Contracts in `packages/shared`:** each request and response is a Zod
  schema used by Fastify for validation and serialisation, by
  `@fastify/swagger` for the OpenAPI document, and by the web app for types.
  The docs cannot drift from the code.
- **Versioning:** URL prefix `/api/v1`. A breaking change would ship as `/api/v2`
  alongside v1 until clients move.
- **JSON uses camelCase**; the database stays snake_case. Repositories map
  explicitly, so a column rename never silently changes the API.
- **Money, prices and quantities are decimal strings** (`"263088.49"`) in
  requests and responses: JSON numbers are floating point in most clients.
  Amounts are in the account's `currency` (INR throughout the data).
- **Error model:** every error is `{ error: { code, message, details?, requestId } }`
  with a stable `code` (`VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401,
  `FORBIDDEN` 403, `NOT_FOUND` 404, `UNPROCESSABLE` 422, `RATE_LIMITED` 429,
  `INTERNAL_ERROR` 500). `details` carries field-level messages. Unexpected
  errors are logged with their stack and returned as a generic 500; stack
  traces never reach clients. `requestId` matches the `x-request-id` header and
  the log lines.
- **400 vs 422:** 400 when the request is malformed (wrong type, missing field,
  bad enum); 422 when it is well-formed but breaks a business rule (a goal
  target date in the past).
- **Pagination:** `page` / `pageSize` (max 100) with `totalItems` and
  `totalPages`. Every paginated query has a unique tie-breaker in its sort, so
  pages never overlap or skip rows. Offset pagination is fine at this scale;
  keyset pagination (`WHERE (trade_date, transaction_id) < (...)`) is the next
  step for large ledgers.
- **Customer scoping:** customer sub-resources join through `accounts` on
  `customer_id`, so passing another customer's `accountId` returns nothing
  rather than leaking data.
- **No N+1:** the portfolio endpoint runs four independent view queries in
  parallel regardless of how many accounts or positions a customer has.
- **Unrealised P/L is additive:** defined as rounded market value minus rounded
  cost basis (migration `…0400_additive_pnl`), so cost + P/L = market value
  exactly at position, account and customer level.
- **Goal rules:** a target date cannot be _set_ in the past (422), but an
  existing goal whose date has passed is kept and flagged `overdue`; funded
  above target is allowed and flagged `overfunded`.

## D8. Authentication and authorisation

- **Session = signed JWT (HS256, 8 h) in an httpOnly cookie**
  (`finpilot_session`, `SameSite=Strict`, `Path=/api`, `Secure` when
  `COOKIE_SECURE=true`).
  - _httpOnly_ keeps the token out of reach of page JavaScript (XSS cannot
    read it); nothing is stored in `localStorage`.
  - _SameSite=Strict_ means browsers never attach it to cross-site requests,
    which covers CSRF for this same-origin app; CORS allows only `WEB_ORIGIN`.
- **Stateless trade-off:** the role is inside the token, so authorisation needs
  no database round trip, but a role change or logout only takes full effect
  when the token expires (logout clears the cookie immediately). Production
  would add short-lived access tokens plus refresh, or server-side sessions.
- **Roles:** `VIEWER` and `ADMIN`. Every route under `/api/v1` except
  `/health`, `/auth/login` and `/auth/logout` requires a session;
  `app.requireRole('ADMIN')` guards admin routes (403 otherwise).
- **Passwords:** scrypt (Node standard library) with a per-user salt, compared
  in constant time. Unknown emails are checked against a dummy hash so response
  time does not reveal which emails exist, and both cases return the same
  message.
- **Login rate limit:** 10 attempts per minute per IP (`@fastify/rate-limit`).
- **Demo users** are created by `pnpm db:seed` with passwords from
  `SEED_VIEWER_PASSWORD` / `SEED_ADMIN_PASSWORD`; no credentials are in code.
- **Logs** redact `Cookie`, `Authorization` and `Set-Cookie`; login attempts,
  forbidden access and goal changes are logged with the user ID.

---

## D9. CI/CD

- **GitHub Actions** (`.github/workflows/ci.yml`) on every push to `main` and
  every pull request; a newer push cancels an in-progress run for the same ref.
- **Steps, each failing the pipeline on error:** install with a frozen
  lockfile → Prettier check → ESLint → TypeScript → `pnpm audit` (fails on
  high/critical advisories) → migrations apply, **roll back to an empty
  schema**, and re-apply → generated Kysely types match the migrated schema →
  tests against a real PostgreSQL 17 service container → production build.
- **Tests use a real database**, not mocks: the service container mirrors the
  local Docker setup, and the test run recreates its database from the
  migrations, so CI proves a clean install works.
- **Least privilege:** the workflow token is `contents: read`; the database
  password is a throwaway value for the ephemeral container, not a secret.
- **Dependabot** opens weekly update PRs for npm packages (minor/patch grouped)
  and GitHub Actions; each PR runs the same pipeline.
- **Deployment:** the brief requires local hosting only. "Deploy" is the
  documented local start (Docker Compose, Phase 7). The production path would
  add a job on `main` that builds and pushes versioned images, runs
  migrations as a separate one-off step, then rolls out; see the architecture
  report.
- **Not used:** CodeQL (SAST) requires GitHub Advanced Security on private
  repositories; the dependency audit and Dependabot cover supply-chain risk.

---

## D10. Frontend

- **Single-page app** (React 19 + Vite) served from the same origin as the API
  (Vite proxies `/api` in development; a reverse proxy does the same in
  production), so the session cookie works without CORS and JavaScript never
  touches the token.
- **Server state in TanStack Query**, never `useEffect` + `useState`: caching,
  request cancellation, de-duplication and retries are handled in one place.
  `useEffect` is not used anywhere in the app. Derived values are computed
  during render; actions happen in event handlers.
- **Filters, sort and page live in the URL** (`useUrlState`): refresh, back/forward
  and shared links keep the exact view. Changing a filter resets to page 1.
- **Server-side pagination and filtering** for customers and transactions;
  `keepPreviousData` keeps the current page visible while the next loads (no
  flicker, no layout jump). Positions (a few dozen rows per customer) are sorted
  and filtered in the browser, but every valuation figure comes from the API.
- **Forms** use Base UI `Form`/`Field` and the **same Zod schema as the API**
  (`packages/shared`). All problems are reported at once, in our wording (no
  native `required` popups); server field errors (400/422) appear under the
  matching field. Edits send only changed fields (true PATCH).
- **Session handling:** any 401 clears the cached session and `RequireAuth`
  redirects to login, returning to the original page afterwards (only
  same-app paths are accepted as `next`, avoiding open redirects). Sign-out
  drops all cached customer data. A page restored from the browser's
  back/forward cache is reloaded so it cannot show data after sign-out, and the
  API marks responses `Cache-Control: no-store`.
- **No TanStack Table:** tables are small, server-paginated and need only
  sorting, so semantic `<table>` primitives (`components/ui/table.tsx`) with
  `aria-sort` headers are simpler and fully accessible.
- **Accessibility:** semantic landmarks and a skip link; every control has a
  label; table captions; sortable headers expose `aria-sort`; gain/loss is
  shown with +/− signs, not colour alone; the allocation chart is decorative
  for screen readers and paired with a visible data table; meters announce
  values (`aria-valuetext`); dialogs trap and restore focus; reduced-motion is
  respected.
- **Visual design follows Recollect's design system:** Inter variable
  (self-hosted, `opsz` 20, metric-matched Arial fallback) at 13–14px / weight
  450 with slight positive tracking; neutral grays on white with alpha grays
  (3–12% black) for fills and hairlines; a near-black primary; borderless
  alpha-gray inputs; `rounded-xl` popups with layered shadows; a left side pane
  whose items fill gray-100 on hover and when current. Class patterns are taken
  from Recollect's Base UI wrappers so the two products feel related. Fonts are
  self-hosted (no third-party requests).
- **Code splitting:** customer pages are lazy routes, so the chart library
  loads only on the overview; the initial bundle is ~107 kB gzipped.
- **Dates** are formatted from the `YYYY-MM-DD` string directly (no `Date`
  objects): no time-zone shift and identical output in every browser.

---

## D11. Admin CSV import

- **Endpoint:** `POST /api/v1/admin/imports/transactions` with the file as the
  request body (`Content-Type: text/csv`, `?fileName=` for the record), not
  `multipart/form-data`. One file per request needs no multipart parser, the
  body limit (5 MB) applies directly, and it is easy to call from curl, Swagger
  and `fetch`.
- **Same pipeline as the seed** (D6): per-row validation, staging table,
  set-based reference checks, merge in one transaction, rejects stored with
  reasons and the original row, per-dataset advisory lock.
- **Status codes:** `201` new batch; `200` with `status: ALREADY_IMPORTED`
  when this exact file (SHA-256) was imported before (idempotent, nothing
  changes); `422` when the file as a whole is unusable (wrong header, not CSV);
  `400` for an empty body or wrong content type; `403` for non-admins.
- **Partial success by design:** valid rows are imported and invalid rows are
  quarantined, rather than rejecting the whole file for one bad row. Operations
  can fix and re-send only the rejected rows (the UI downloads them as CSV with
  the reasons). A file-level all-or-nothing mode would be a flag on the same
  pipeline.
- **Response size:** up to 200 rejected rows inline (`rejectsTruncated`
  flags more); the full list is paginated at
  `GET /admin/imports/{batchId}/rejects`. `GET /admin/imports` is the batch
  history with who uploaded it.
- **Audit:** every batch records file name, SHA-256, counts, uploader and
  timestamps; every import logs one structured line (`import completed`) with
  the batch ID, counts and user ID.
- **Authorisation:** all `/admin/*` routes sit behind
  `app.requireRole('ADMIN')`; the web route is wrapped in
  `<RequireAuth role="ADMIN">` and the menu item is hidden for viewers. The UI
  check is convenience only; the API enforces it.
- **Empty enum cells** are reported as `REQUIRED` (not `INVALID_ENUM`), so the
  reason tells the data provider what to fix.

---

## D12. Deployment: local topology and the path to production

**Local (Docker Compose, `docker compose up --build`):**

```
browser ──► web (nginx, :8088 on 127.0.0.1)
              ├─ static SPA (index.html no-cache; hashed assets cached 1 year)
              └─ /api/* ──► api (Fastify, :3000, not published) ──► db (PostgreSQL 17)
migrate (one-off): dbmate up → seed → exit 0, before api starts
```

- **Same origin through nginx**, like production: no CORS, the session cookie
  is first-party, and the API is not exposed on the host.
- **Start-up is ordered by health, not sleeps:** `db` healthy →
  `migrate` completed successfully → `api` healthy (HTTP check of `/health`) →
  `web`. A failed migration stops the chain: the API never starts on a
  half-migrated schema, and dbmate runs each migration in a transaction, so
  the failed one leaves no partial changes.
- **Images:** multi-stage builds; the API runtime holds only `dist/`,
  production `node_modules` (`pnpm deploy --prod`), migrations and the seed
  CSVs, and runs as the unprivileged `node` user. The web image is
  `nginx-unprivileged` (non-root, port 8080).
- **Security headers** at the edge: CSP (`default-src 'self'`,
  `frame-ancestors 'none'`), `X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`; `server_tokens off`.
- **Proxy awareness:** `TRUST_PROXY=true` so rate limiting and logs use the
  client IP from `X-Forwarded-For`; nginx forwards its `$request_id` as
  `X-Request-Id`, so one ID follows a request from the edge to the API logs.
- **Configuration** only from `.env` (git-ignored); Compose refuses to start
  when a required secret is missing (`${JWT_SECRET:?…}`).
- **Verified in CI:** the `docker-stack` job builds the images, starts the
  stack, runs `scripts/smoke-test.sh` and checks idempotent restart.

**Production mapping (not built; the brief requires local hosting):**

| Local                 | Production                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nginx container       | Managed load balancer / CDN terminating TLS (HSTS, `COOKIE_SECURE=true`), static assets on the CDN                                                                              |
| api container         | 2+ replicas on a container platform (ECS/Cloud Run/Kubernetes), health-checked, rolling deploys                                                                                 |
| migrate container     | One-off release job before the new API version rolls out; migrations written backward-compatible (expand → migrate → contract) so old and new API versions can run side by side |
| PostgreSQL container  | Managed PostgreSQL (multi-AZ, automated backups + point-in-time recovery), app connects via PgBouncer or the platform pooler                                                    |
| `.env`                | Secret manager (rotated `JWT_SECRET`, per-service least-privilege DB roles: migration role owns DDL, app role DML only)                                                         |
| `docker compose logs` | Central log aggregation (JSON logs, searchable by `reqId`, `batchId`, `userId`), metrics and alerts on 5xx rate, latency, failed imports                                        |
| GitHub Actions CI     | Same pipeline plus: push signed, versioned images to a registry; deploy to staging on `main`; promote to production on approval                                                 |

---

## Assumptions, deliberate omissions and known limitations

**Assumptions**

- All amounts are INR (the only currency in the data); no FX conversion.
- The holdings snapshot is the source of truth for positions and the
  instrument `last_price` for valuation; transactions are an activity ledger
  and do not reconcile to holdings in the supplied data.
- "Today" for future-date checks is the server's UTC date; goal target dates
  are compared with it.
- Transaction amounts are always positive; direction comes from the type.
- A goal whose name mentions a different goal type is suspicious, not invalid.

**Deliberate omissions**

- Trading, payments, advice and real market data (out of scope by the brief).
- Sign-up, password reset, MFA/SSO, refresh tokens and session revocation.
- Admin UI imports transactions only (the pipeline supports every dataset).
- Cloud deployment and TLS (documented production mapping instead, D12).
- Editing or deleting imported ledger rows (never overwrite; corrections
  would need an audited workflow).

**Known limitations**

- Offset pagination and `ILIKE` search suit thousands of rows, not millions
  (next: keyset pagination, `pg_trgm`).
- Valuations are computed by views on read; at scale a materialised daily
  valuation would replace them.
- Imports hold the file in memory (5 MB cap).
- Stateless JWT: a role change or sign-out elsewhere takes effect at token
  expiry (8 h); sign-out in the same browser is immediate.
- Rate limiting is in-memory per API process; multiple replicas would need a
  shared store (Redis).
- Timestamps in the import history use the viewer's time zone; business dates
  are plain calendar dates.
