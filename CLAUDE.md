# FinPilot — project guide

Internal investment portfolio & goal monitoring app, built for the FinPilot
full-stack assessment. Synthetic data only. Brief: `docs/assignment-brief.docx`.
Decisions and rationale: `DECISIONS.md`. Data anomalies: `docs/data-audit.md`.

The author must explain and live-edit this code in a review interview:
**prefer readable, explainable code over clever code.**

## Requirements (from the brief)

**Product.** A service/wealth user searches a customer and sees profile, KYC,
segment, latest risk profile, portfolio, transactions and goals. An ADMIN can
import CSV data safely.

**Auth.** Sign-in with seeded demo users; roles `VIEWER` and `ADMIN` (only
ADMIN may import). Protect pages and non-public endpoints.

**Screens.** Login · customer search · customer overview (risk summary, total
value, account cards, asset-allocation chart, goal summary) · positions table
· transactions (server-side filters + pagination) · goals (create/edit) ·
admin import (counts + row-level rejection reasons).

**API** (versioned `/api/v1`, OpenAPI at `/api/docs`, examples for portfolio and
import):

| Method | Path                           | Behaviour                                                 |
| ------ | ------------------------------ | --------------------------------------------------------- |
| POST   | `/auth/login`                  | Authenticate, set session cookie                          |
| GET    | `/customers`                   | Search by id/name/email/city, filter, paginate            |
| GET    | `/customers/{id}`              | Profile + latest risk summary                             |
| GET    | `/customers/{id}/portfolio`    | Customer/account totals, allocation, positions            |
| GET    | `/customers/{id}/transactions` | Filters (date, account, instrument, type), sort, paginate |
| GET    | `/customers/{id}/goals`        | Goals with funded % = funded / target                     |
| POST   | `/customers/{id}/goals`        | Create validated goal                                     |
| PATCH  | `/goals/{goalId}`              | Edit selected fields                                      |
| POST   | `/admin/imports/transactions`  | Validate/import CSV; counts + rejected rows               |
| GET    | `/health`                      | Liveness/readiness, no secrets                            |

**Business rules.**

- Market value = holdings quantity × instrument `last_price`; unrealised P/L =
  quantity × (last_price − avg_cost). Show price date and snapshot date.
- Aggregation happens in PostgreSQL (views/queries), never in the browser.
- Holdings snapshot is the source of truth for positions; transactions are an
  activity ledger (they do not reconcile — see data audit).
- REVERSED and PENDING transactions must be visually distinct.
- Highlight overdue or logically inconsistent goals.
- Imports are idempotent (re-uploading a file is a no-op), validate FKs, dates,
  enums and numbers, never silently overwrite, and record rejected-row reasons.
  Stage → validate → merge inside one DB transaction.
- `transactions.csv` must import as **4,550 accepted / 4 rejected**.

**PostgreSQL.** Explicit schema via migrations: PKs, FKs, NOT NULL, UNIQUE,
CHECK. Indexes from real query patterns (be ready to show
`EXPLAIN (ANALYZE, BUFFERS)`). Parameterised queries only. Transactions for
multi-step writes. At least one aggregation view. Must support the SQL tasks:
top 10 customers by AUM, allocation per customer and overall, monthly BUY/SELL
net flow (12 months), top instruments by distinct holders, HIGH-priority goals
under 25% funded, data-quality/reconciliation exceptions.

**Non-functional.** Responsive (desktop, tablet, basic mobile); loading, empty,
validation and error states everywhere; accessible (labels, keyboard, chart
text alternatives); no N+1 queries; no stack traces to users; structured logs
with request IDs; meaningful tests for at least one business path and one API
path.

**Delivery.** Runs locally with one command (Docker Compose), migrations from a
clean DB then seed from CSVs, GitHub Actions lint → test → build on push/PR,
`.env.example` committed and no secrets, meaningful Git history, README,
`DECISIONS.md`, and a 5–10 page architecture report (ERD, system, deployment,
workflows: login, portfolio read, goal update, CSV import, CI/CD).

**Out of scope.** Payments, order routing, investment advice, cloud hosting,
real data. Never edit files in `data/raw/` to hide anomalies.

## Stack and layout

pnpm workspaces · TypeScript 6 · Node 24.

```
apps/api/          Fastify 5 + Zod (fastify-type-provider-zod) + Kysely + pino
apps/web/          React 19 + Vite + Tailwind 4 + TanStack Query + Base UI
packages/shared/   Zod schemas/types shared by API and web
db/migrations/     plain SQL migrations (dbmate)
data/raw/          supplied CSVs, unmodified (CRLF, checksummed)
docs/              data audit, primers, brief
```

## Commands

```bash
pnpm db:up          # Postgres 17 on localhost:5433 (docker compose)
pnpm db:migrate     # apply db/migrations (dbmate); db:rollback reverts one
pnpm db:seed        # import data/raw CSVs via the import pipeline (idempotent)
pnpm db:reset       # wipe volume, migrate, seed
pnpm db:codegen     # regenerate apps/api/src/db/schema.ts after a migration
pnpm dev            # API :3000, web :5173 (proxies /api to the API)
pnpm lint | typecheck | test | build | format
```

Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` before
declaring work done; CI (`.github/workflows/ci.yml`) runs the same checks plus a
migration rollback check and `kysely-codegen --verify`, so run `pnpm db:codegen`
after any migration.

Remote: https://github.com/rogerantony-dev/finpilot (private), branch `main`.

## Conventions

### Frontend: UI components go through wrappers

- **Never import `@base-ui/react` outside `apps/web/src/components/ui/`.**
  ESLint (`no-restricted-imports`) enforces this.
- Feature code imports primitives only from `components/ui`
  (`import { Button, Field } from '../components/ui'`).
- Each wrapper owns its styling and defaults, merges the caller's `className`
  with `mergeClassName` from `lib/cn.ts` (Base UI `className` may be a string
  or a function of state), and re-exports Base UI's props type.
- Need a primitive that has no wrapper yet? Add a wrapper in `components/ui/`,
  export it from `components/ui/index.ts`, then use it.
- Style state with Base UI data attributes (`data-disabled`, `data-invalid`,
  `data-checked`, …) rather than extra props.
- Server state via TanStack Query; no data fetching in `useEffect`.

### Backend

- Code is organised by area in `apps/api/src/modules/<area>/`:
  `<area>.routes.ts` (HTTP) → `<area>.service.ts` (business rules, only when
  there are any) → `<area>.repository.ts` (Kysely queries + snake→camel
  mapping). Register routes in `app.ts` under `/api/v1`; anything not public
  goes inside the `secured` scope (session required). Admin routes add
  `preHandler: app.requireRole('ADMIN')`.
- Request/response schemas live in `packages/shared/src/`; import them in
  routes. JSON is camelCase; money/quantities are decimal strings.
- Throw `AppError` / `notFound()` / `unprocessable()` (`lib/errors.ts`) for
  expected failures; the error plugin formats every error the same way.
- Every route declares Zod schemas for params/query/body **and** responses;
  that drives validation, serialisation and the OpenAPI document.
- SQL through Kysely only (parameterised). No string-concatenated SQL.
- Configuration only through `loadConfig()` (validated env); never read
  `process.env` elsewhere.
- Log with `req.log` / `app.log`; never log secrets, cookies or full PII.
- Errors to clients use one consistent JSON error shape; no stack traces.

### Database

- Schema changes only via new SQL files in `db/migrations/` (with `-- migrate:up`
  and `-- migrate:down`); never edit an applied migration. Run `pnpm db:codegen`
  afterwards; `apps/api/src/db/schema.ts` is generated, never hand-edited.
- Portfolio math lives in the views (`v_positions` etc.); query them rather
  than re-deriving market value in TypeScript.
- All CSV loading goes through `importCsv` (`apps/api/src/imports/`); tests run
  against `TEST_DATABASE_URL`, recreated from migrations each run.
- Money and quantities are `NUMERIC`, never floats.
- Constraints belong in the database (CHECK/FK/UNIQUE) as well as in Zod.

### Documentation

- Record every non-trivial decision in `DECISIONS.md` (numbered D1, D2, …) with
  why and what was rejected.
- Concept explainers go in `docs/` (e.g. `docs/postgres-primer.md`).
- Keep README commands and URLs accurate when they change.

### Git

- Small, meaningful commits per phase/feature (conventional-commit style,
  e.g. `feat(api): …`, `chore: …`). Never commit `.env`, `dist/` or
  `node_modules/`.
