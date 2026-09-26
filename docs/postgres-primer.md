# PostgreSQL primer: CHECK constraints, views, partial indexes

Three PostgreSQL features FinPilot relies on, with examples from this project.
These are why migrations are written in plain SQL (see `DECISIONS.md`, D2).

## 1. CHECK constraint — a rule the database enforces on every row

A condition on a column. If a row breaks it, PostgreSQL refuses the insert or
update, regardless of whether the row came from the API, the CSV import or a
manual SQL session.

```sql
CREATE TABLE transactions (
  ...
  amount   NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  status   TEXT NOT NULL CHECK (status IN ('SETTLED','PENDING','REVERSED'))
);

CREATE TABLE goals (
  ...
  target_amount          NUMERIC(18,2) NOT NULL CHECK (target_amount > 0),
  current_funded_amount  NUMERIC(18,2) NOT NULL CHECK (current_funded_amount >= 0)
);
```

The negative fee in the supplied data (`T0004552`, amount `-75`) is rejected:

```
ERROR: new row violates check constraint "transactions_amount_check"
```

Application code validates first and returns friendly errors; the CHECK is the
last line of defence, so bad data cannot get in even if the code has a bug.

## 2. View — a saved query you read like a table

Queries that are needed repeatedly (e.g. "market value of every position") are
defined once and given a name:

```sql
CREATE VIEW v_positions AS
SELECT h.account_id,
       h.instrument_id,
       i.asset_class,
       h.quantity,
       h.avg_cost,
       i.last_price,
       h.quantity * i.last_price                   AS market_value,
       h.quantity * (i.last_price - h.avg_cost)    AS unrealised_pnl
FROM holdings h
JOIN instruments i USING (instrument_id);
```

Endpoints then query the view directly:

```sql
SELECT asset_class, SUM(market_value)
FROM v_positions
WHERE account_id IN (...)
GROUP BY asset_class;
```

This keeps aggregation in the database rather than in browser JavaScript, and
gives one definition of "market value" for the whole system.

## 3. Partial index — an index over only some rows

A normal index covers every row. A partial index adds a `WHERE`, covering only
the rows that are actually searched:

```sql
-- normal index: every transaction
CREATE INDEX ix_tx_account_date ON transactions (account_id, trade_date DESC);

-- partial index: only the ~235 PENDING/REVERSED rows, not all ~4,550
CREATE INDEX ix_tx_open ON transactions (account_id)
WHERE status <> 'SETTLED';
```

Smaller and faster than a full index, and chosen from real query patterns
rather than indexing every column.

## ORM support

| Feature           | Plain SQL | Kysely                  | Drizzle    | Prisma          |
| ----------------- | --------- | ----------------------- | ---------- | --------------- |
| CHECK constraints | ✅        | ✅ (via SQL migrations) | ⚠️ partial | ❌ raw SQL only |
| Views             | ✅        | ✅ queried as tables    | ⚠️ partial | ❌ limited      |
| Partial indexes   | ✅        | ✅ (via SQL migrations) | ⚠️ partial | ❌ raw SQL only |

## Constraints vs row-level security (RLS)

They solve different problems:

|          | Constraints (used)      | Row-level security (not used)             |
| -------- | ----------------------- | ----------------------------------------- |
| Question | Is this data **valid**? | May this user **see or change** this row? |
| Scope    | Every writer, every row | Per database role / session               |
| Example  | `CHECK (amount > 0)`    | "an advisor sees only their customers"    |

**How FinPilot controls access instead:** in the API. No valid session
cookie → 401; a VIEWER calling an admin route → 403
(`app.requireRole('ADMIN')`); customer sub-resources join through
`accounts.customer_id`, so another customer's `accountId` returns nothing.
The API connects as one database user, so PostgreSQL does not know which
person is signed in.

**Why no RLS:** every staff user may see every customer, and the only role
difference (import) is a whole feature, not a subset of rows; enforcing it
once in the API is simpler to test and explain.

**When RLS would be added:** per-advisor books of customers, multi-tenant
data, or clients that reach the database directly. Sketch:

```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY advisor_sees_own_customers ON customers
  FOR SELECT USING (advisor_id = current_setting('app.user_id')::bigint);
-- per request, inside the transaction:
-- SET LOCAL app.user_id = '<signed-in user id>';
```

Every query, including the views, would then return only that advisor's
rows, even if an endpoint forgot to filter: defence in depth behind the API.
