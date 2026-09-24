# FinPilot — what the app is

An internal tool for staff at a fictional investment firm: look up a customer,
see their whole investment picture, manage their savings goals, and (admins
only) import transaction data safely. Synthetic data only.

## Users and roles

| Role   | Who                              | Can do                                        |
| ------ | -------------------------------- | --------------------------------------------- |
| VIEWER | Wealth/service staff (demo user) | Search customers, view all, create/edit goals |
| ADMIN  | Operations staff (demo user)     | Everything above, plus CSV import             |

## Screens

1. **Login** — email + password → `POST /api/v1/auth/login` sets an httpOnly
   session cookie. All other pages redirect here when signed out.
2. **Customer search** — search by ID, name, email or city; filter by KYC,
   segment, city; server-side pagination (`GET /customers`). Loading, empty and
   error states.
3. **Customer overview** — profile, KYC, segment, latest risk profile
   (`GET /customers/{id}`); total value, invested, gain/loss, price and snapshot
   dates, account cards, asset-allocation chart with table fallback, goal
   summary (`GET /customers/{id}/portfolio`). Missing relationships handled.
4. **Positions** — per holding: quantity, avg cost, latest price, market value,
   unrealised gain/loss; account and customer totals; sortable.
5. **Transactions** — server-side filters (date range, account, instrument,
   type), sorting and pagination (`GET /customers/{id}/transactions`). PENDING
   and REVERSED visually distinct. Filters kept in the URL.
6. **Goals** — funded % = funded ÷ target; flags for overdue, high priority
   under 25%, over-funded, name/type mismatch. Create/edit dialog with
   client- and server-side validation (`POST /customers/{id}/goals`,
   `PATCH /goals/{id}`).
7. **Admin import** (ADMIN only; VIEWER gets 403) — upload CSV, see imported /
   rejected / duplicate counts and row-level reasons; re-uploading the same file
   changes nothing; import history.

## Request path (example: edit a goal)

```
React form (client validation)
  → PATCH /api/v1/goals/{id}  (session cookie)
Fastify: request ID + log → auth (401) → Zod validation (400) → service rules (404/422)
  → Kysely parameterised UPDATE
PostgreSQL: CHECK constraints as last line of defence
  → updated goal returned → TanStack Query refreshes the view
```

## Data layer

- Tables for the 7 CSVs plus `users`, `import_batches`, `import_rejects`.
- Views: `v_positions` (market value, P/L), `v_customer_portfolio` (totals),
  allocation, monthly flows, data-quality exceptions.
- Import pipeline: file hash (idempotency) → staging table → per-row validation
  → rejects recorded with reason codes → valid rows merged, all in one DB
  transaction. The seed uses the same rules (expected 4,550 accepted / 4
  rejected transactions).

## Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "…",
    "details": [{ "field": "target_amount", "message": "Must be greater than 0" }],
    "requestId": "…"
  }
}
```

## Around the app

| Piece          | What                                                               |
| -------------- | ------------------------------------------------------------------ |
| Docker Compose | db → migrate + seed → API → web, one command                       |
| GitHub Actions | install → lint → typecheck → test (real Postgres) → build          |
| Tests          | portfolio math, goal rules, import rules, auth/role/validation API |
| Logs           | JSON, request IDs, import outcomes                                 |
| Docs           | README, DECISIONS.md, data audit, architecture report (Word/PDF)   |

## Out of scope

Trading, payments, advice, cloud hosting, mobile app, sign-up/password reset,
real market data.
