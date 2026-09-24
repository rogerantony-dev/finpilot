# SQL tasks and query performance

Queries for the SQL tasks listed in the brief (§6.1), runnable against a seeded
database:

```bash
docker compose exec db psql -U finpilot -d finpilot
```

Most read from the reporting views in
`db/migrations/20260925000300_reporting_views.sql`, so "market value" and
"funded %" have a single definition shared with the API.

## 1. Top 10 customers by current snapshot AUM

```sql
SELECT c.customer_id, c.full_name, p.market_value, p.account_count
FROM v_customer_portfolio p
JOIN customers c USING (customer_id)
ORDER BY p.market_value DESC
LIMIT 10;
```

Result (top 3): C0026 Rohan Kulkarni ₹19,53,574.61 · C0100 Ananya Malhotra
₹18,53,671.75 · C0008 Kabir Singh ₹15,25,930.15. Book total ₹5,27,54,963.55,
cross-checked against an independent calculation from the raw CSVs.

## 2. Asset-class allocation — one customer and the whole book

```sql
-- One customer
SELECT asset_class, market_value, weight_pct
FROM v_asset_allocation
WHERE customer_id = 'C0002'
ORDER BY market_value DESC;

-- Whole dataset
SELECT asset_class,
       sum(market_value) AS market_value,
       round(100 * sum(market_value) / sum(sum(market_value)) OVER (), 2) AS weight_pct
FROM v_positions
GROUP BY asset_class
ORDER BY market_value DESC;
```

Whole book: EQUITY 83.75% · ETF 7.65% · MUTUAL_FUND 3.05% · BOND 2.89% ·
REIT 1.65% · GSEC 1.02%. `sum(sum(...)) OVER ()` is a window over the grouped
rows: the grand total, computed in the same pass.

## 3. Monthly BUY/SELL net cash flow, last 12 months

```sql
SELECT month, buy_amount, sell_amount, net_invested, trade_count
FROM v_monthly_net_flows
WHERE month >= date_trunc('month', current_date) - interval '11 months'
ORDER BY month;
```

Settled trades only. `net_invested = BUY − SELL`; positive means net money went
into the market that month. Uses `sum(...) FILTER (WHERE ...)` to pivot BUY and
SELL into columns in one scan.

## 4. Top instruments by number of distinct holders

```sql
SELECT i.instrument_id, i.instrument_name, i.asset_class,
       count(DISTINCT a.customer_id) AS holders
FROM holdings h
JOIN accounts a    USING (account_id)
JOIN instruments i USING (instrument_id)
GROUP BY i.instrument_id, i.instrument_name, i.asset_class
ORDER BY holders DESC, i.instrument_id
LIMIT 10;
```

Counts distinct _customers_, not accounts: one customer holding the same fund
in two accounts counts once. Top: I0049 FinPilot Mutual Fund 5 (26 holders).

## 5. High-priority goals below 25% funded

```sql
SELECT goal_id, customer_id, goal_name, funded_pct
FROM v_goal_status
WHERE is_high_priority_underfunded
ORDER BY funded_pct;
```

12 goals; lowest is G00083 at 3.33%.

## 6. Data-quality / reconciliation exceptions

```sql
SELECT exception_type, count(*)
FROM v_data_quality_exceptions
GROUP BY exception_type
ORDER BY count(*) DESC;
```

| exception_type                  | count |
| ------------------------------- | ----: |
| TRADE_BEFORE_ACCOUNT_OPENED     |  1069 |
| ACTIVITY_ON_CLOSED_ACCOUNT      |   114 |
| IMPORT_REJECT:DUPLICATE_ROW     |     4 |
| IMPORT_REJECT:FUTURE_DATE       |     1 |
| IMPORT_REJECT:UNKNOWN_REFERENCE |     1 |
| IMPORT_REJECT:NEGATIVE_AMOUNT   |     1 |

Duplicate positions and duplicate transaction IDs cannot exist in the tables
(primary keys); they surface here as import rejects instead. Row detail:

```sql
SELECT * FROM import_rejects ORDER BY batch_id, line_number;
```

## EXPLAIN (ANALYZE, BUFFERS): transaction list

The transactions screen runs this shape of query (one customer, date range,
newest first, one page):

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT t.*
FROM transactions t
WHERE t.account_id IN (SELECT account_id FROM accounts WHERE customer_id = 'C0026')
  AND t.trade_date BETWEEN '2026-01-01' AND '2026-09-18'
ORDER BY t.trade_date DESC, t.transaction_id DESC
LIMIT 25;
```

```
Limit  (actual time=0.056..0.059 rows=25 loops=1)
  Buffers: shared hit=19
  ->  Sort  (actual time=0.055..0.056 rows=25 loops=1)
        Sort Key: t.trade_date DESC, t.transaction_id DESC
        Sort Method: quicksort  Memory: 29kB
        ->  Nested Loop  (actual time=0.014..0.030 rows=33 loops=1)
              ->  Seq Scan on accounts  (rows=3 loops=1)
                    Filter: (customer_id = 'C0026'::text)
                    Rows Removed by Filter: 164
              ->  Index Scan using transactions_account_date_idx on transactions t
                    (actual time=0.004..0.004 rows=11 loops=3)
                    Index Cond: ((account_id = accounts.account_id)
                                 AND (trade_date >= '2026-01-01') AND (trade_date <= '2026-09-18'))
Execution Time: 0.094 ms
```

How to read it:

- **Index Scan on `transactions_account_date_idx`**: for each of the customer's
  3 accounts, the composite index `(account_id, trade_date DESC,
transaction_id DESC)` jumps straight to that account's rows in the date range.
  Without it PostgreSQL would scan all 4,550 transactions.
- **Seq Scan on accounts** is correct here: 167 rows fit in 2 pages, cheaper
  than an index look-up. `accounts_customer_id_idx` takes over as the table
  grows.
- **Buffers: shared hit=19**: 19 pages read, all from memory; no disk I/O.
- **Sort** of 33 rows in 29 kB: trivial. At larger scale, a single-account
  filter lets the index return rows already ordered, removing the sort.
