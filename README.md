# FinPilot

[![CI](https://github.com/rogerantony-dev/finpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/rogerantony-dev/finpilot/actions/workflows/ci.yml)

Investment portfolio and goal monitoring platform for an internal wealth-service
team. Built for the FinPilot full-stack assessment using **synthetic data only**.

> Status: database, seed, REST API, CI, web app and admin CSV import done
> (Phases 1–6). Next: one-command Docker Compose and the architecture report — see [DECISIONS.md](DECISIONS.md).

## Stack

React + Vite · Fastify + Zod + Kysely · PostgreSQL 17 · pnpm workspaces ·
Vitest · GitHub Actions. Rationale in [DECISIONS.md](DECISIONS.md).

## Repository layout

```
apps/
  api/          Fastify REST API (/api/v1), Swagger at /api/docs
  web/          React single-page app
packages/
  shared/       Zod schemas and types shared by API and web
db/
  migrations/   Plain SQL migrations (dbmate)
data/raw/       Supplied synthetic CSVs, unmodified (SHA256SUMS included)
docs/           Data audit, PostgreSQL primer, assignment brief
```

## Prerequisites

- Node.js 24+ and pnpm 10 (`corepack enable`)
- Docker (for PostgreSQL)

## Local setup

```bash
cp .env.example .env              # then set JWT_SECRET: openssl rand -hex 32
pnpm install
pnpm db:up                        # PostgreSQL on localhost:5433
pnpm db:migrate                   # create the schema from db/migrations
pnpm db:seed                      # load data/raw/*.csv (safe to re-run)
pnpm dev                          # API :3000 + web :5173
```

| What         | URL                                 |
| ------------ | ----------------------------------- |
| Web app      | http://localhost:5173               |
| API base     | http://localhost:3000/api/v1        |
| Health       | http://localhost:3000/api/v1/health |
| Swagger UI   | http://localhost:3000/api/docs      |
| OpenAPI JSON | http://localhost:3000/api/docs/json |

## Using the app

Open http://localhost:5173 and sign in with a demo user below.

| Screen                  | What it shows                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customers               | Search by name, ID, email or city; filter by KYC, segment, city; sortable, paginated on the server                                                                                 |
| Customer → Overview     | Profile, KYC, segment, latest risk profile; portfolio value, gain/loss, cost basis, data freshness; asset-allocation chart with data table; account cards; goals needing attention |
| Customer → Positions    | Quantity, average cost, last price, market value, unrealised P/L per position; filter by account; totals                                                                           |
| Customer → Transactions | Date range, account, instrument, type and status filters; sort by date or amount; PENDING and REVERSED visually distinct                                                           |
| Customer → Goals        | Funded %, overdue / under-funded / over-funded / name-type flags; create and edit with validation                                                                                  |

Filters and pages are kept in the URL, so links can be shared.

## Demo users

Created by `pnpm db:seed`; passwords come from `.env` (defaults in
`.env.example`, local demo only):

| Email                  | Role   | Password (default)                          |
| ---------------------- | ------ | ------------------------------------------- |
| `viewer@finpilot.test` | VIEWER | `SEED_VIEWER_PASSWORD` (`viewer-demo-2026`) |
| `admin@finpilot.test`  | ADMIN  | `SEED_ADMIN_PASSWORD` (`admin-demo-2026`)   |

## API

Base URL `http://localhost:3000/api/v1`. Interactive docs with request and
response schemas at http://localhost:3000/api/docs: call `POST /auth/login`
there and the session cookie is used for the other endpoints.

| Method     | Path                           | Purpose                                 |
| ---------- | ------------------------------ | --------------------------------------- |
| GET        | `/health`                      | Liveness/readiness (public)             |
| POST       | `/auth/login` · `/auth/logout` | Start / end session (httpOnly cookie)   |
| GET        | `/auth/me`                     | Current user                            |
| GET        | `/customers`                   | Search (`q`), filter, sort, paginate    |
| GET        | `/customers/cities`            | Filter options                          |
| GET        | `/customers/{id}`              | Profile + latest risk profile           |
| GET        | `/customers/{id}/portfolio`    | Totals, accounts, allocation, positions |
| GET        | `/customers/{id}/transactions` | Filtered, sorted, paginated ledger      |
| GET        | `/instruments`                 | Filter options                          |
| GET · POST | `/customers/{id}/goals`        | List / create goals                     |
| PATCH      | `/goals/{goalId}`              | Edit a goal                             |

```bash
curl -c jar -X POST localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"viewer@finpilot.test","password":"viewer-demo-2026"}'
curl -b jar localhost:3000/api/v1/customers/C0002/portfolio
```

Errors always look like
`{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "field": "…", "message": "…" }], "requestId": "…" } }`.
Design notes: `DECISIONS.md` D7 (API) and D8 (auth).

## Environment variables

All variables are documented in [`.env.example`](.env.example). `.env` is
git-ignored; the API validates its configuration at start-up and refuses to
boot with missing or malformed values.

## Scripts

| Command                        | Does                               |
| ------------------------------ | ---------------------------------- |
| `pnpm dev`                     | Run API and web in watch mode      |
| `pnpm build`                   | Build shared, API and web          |
| `pnpm lint`                    | ESLint across the repo             |
| `pnpm typecheck`               | TypeScript checks in every package |
| `pnpm test`                    | Vitest in every package            |
| `pnpm format` / `format:check` | Prettier                           |
| `pnpm db:up` / `db:down`       | Start / stop PostgreSQL            |

## Data

The supplied CSVs live unmodified in `data/raw/`. `pnpm db:seed` imports them
in foreign-key order through the same validation pipeline as the admin upload,
and prints accepted/rejected counts plus the reason for every rejected row.
Expected: transactions 4,550 accepted / 4 rejected; holdings 982 / 3; all
other files fully accepted.

- Demo files for the import screen, with expected results:
  [data/samples/README.md](data/samples/README.md)

```bash
# Import from the command line (as admin)
curl -c jar -X POST localhost:3000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@finpilot.test","password":"admin-demo-2026"}'
curl -b jar -X POST 'localhost:3000/api/v1/admin/imports/transactions?fileName=transactions_with_errors.csv' \
  -H 'content-type: text/csv' --data-binary @data/samples/transactions_with_errors.csv
```

- Data-quality issues and handling: [docs/data-audit.md](docs/data-audit.md)
- SQL tasks and `EXPLAIN` walkthrough: [docs/sql-tasks.md](docs/sql-tasks.md)

## CI

GitHub Actions runs on every push to `main` and every pull request
([runs](https://github.com/rogerantony-dev/finpilot/actions)): format check →
lint → typecheck → dependency audit → migrations apply / roll back / re-apply
→ generated DB types up to date → tests against PostgreSQL 17 → build. Any
failing step fails the run. Details: `DECISIONS.md` D9.

## Tests

`pnpm test` recreates a separate `finpilot_test` database from the migrations
(`TEST_DATABASE_URL`) and runs the suites against it; your seeded data is never
touched. PostgreSQL must be running (`pnpm db:up`).
