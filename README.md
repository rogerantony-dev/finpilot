# FinPilot

Investment portfolio and goal monitoring platform for an internal wealth-service
team. Built for the FinPilot full-stack assessment using **synthetic data only**.

> Status: schema, migrations and CSV seed done (Phase 2). API endpoints, UI
> screens and the admin import screen land in later phases — see [DECISIONS.md](DECISIONS.md).

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

- Data-quality issues and handling: [docs/data-audit.md](docs/data-audit.md)
- SQL tasks and `EXPLAIN` walkthrough: [docs/sql-tasks.md](docs/sql-tasks.md)

## Tests

`pnpm test` recreates a separate `finpilot_test` database from the migrations
(`TEST_DATABASE_URL`) and runs the suites against it; your seeded data is never
touched. PostgreSQL must be running (`pnpm db:up`).
