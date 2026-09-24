-- migrate:up

-- Latest risk assessment per customer.
CREATE VIEW v_latest_risk_profile AS
SELECT DISTINCT ON (customer_id)
  customer_id, assessed_at, risk_score, risk_level, horizon_years, liquidity_need
FROM risk_profiles
ORDER BY customer_id, assessed_at DESC;

-- One row per position in the latest holdings snapshot, valued at the latest
-- instrument price. The single definition of market value and P/L.
CREATE VIEW v_positions AS
SELECT
  a.customer_id,
  h.account_id,
  a.account_type,
  a.status                                         AS account_status,
  h.instrument_id,
  i.symbol,
  i.instrument_name,
  i.asset_class,
  h.quantity,
  h.avg_cost,
  i.last_price,
  h.snapshot_date,
  i.price_as_of,
  round(h.quantity * h.avg_cost, 2)                AS cost_basis,
  round(h.quantity * i.last_price, 2)              AS market_value,
  round(h.quantity * (i.last_price - h.avg_cost), 2) AS unrealised_pnl
FROM holdings h
JOIN accounts a    ON a.account_id = h.account_id
JOIN instruments i ON i.instrument_id = h.instrument_id
WHERE h.snapshot_date = (SELECT max(snapshot_date) FROM holdings);

-- Per-account totals. LEFT JOIN keeps accounts with no holdings (value 0).
CREATE VIEW v_account_valuation AS
SELECT
  a.account_id,
  a.customer_id,
  a.account_type,
  a.provider,
  a.status,
  a.opened_at,
  a.base_currency,
  count(p.instrument_id)::int                AS position_count,
  coalesce(sum(p.cost_basis), 0)             AS cost_basis,
  coalesce(sum(p.market_value), 0)           AS market_value,
  coalesce(sum(p.unrealised_pnl), 0)         AS unrealised_pnl,
  max(p.snapshot_date)                       AS snapshot_date,
  max(p.price_as_of)                         AS price_as_of
FROM accounts a
LEFT JOIN v_positions p ON p.account_id = a.account_id
GROUP BY a.account_id;

-- Per-customer totals (assets under management).
CREATE VIEW v_customer_portfolio AS
SELECT
  c.customer_id,
  count(av.account_id)::int                  AS account_count,
  coalesce(sum(av.position_count), 0)::int   AS position_count,
  coalesce(sum(av.cost_basis), 0)            AS cost_basis,
  coalesce(sum(av.market_value), 0)          AS market_value,
  coalesce(sum(av.unrealised_pnl), 0)        AS unrealised_pnl,
  max(av.snapshot_date)                      AS snapshot_date,
  max(av.price_as_of)                        AS price_as_of
FROM customers c
LEFT JOIN v_account_valuation av ON av.customer_id = c.customer_id
GROUP BY c.customer_id;

-- Asset-class allocation per customer, with each class's share of the total.
CREATE VIEW v_asset_allocation AS
SELECT
  customer_id,
  asset_class,
  sum(market_value) AS market_value,
  round(100 * sum(market_value) / nullif(sum(sum(market_value)) OVER (PARTITION BY customer_id), 0), 2)
                    AS weight_pct
FROM v_positions
GROUP BY customer_id, asset_class;

-- Settled BUY/SELL cash flow per calendar month (whole book).
-- net_invested > 0 means more was bought than sold that month.
CREATE VIEW v_monthly_net_flows AS
SELECT
  date_trunc('month', trade_date)::date                                   AS month,
  sum(amount) FILTER (WHERE transaction_type = 'BUY')                     AS buy_amount,
  sum(amount) FILTER (WHERE transaction_type = 'SELL')                    AS sell_amount,
  coalesce(sum(amount) FILTER (WHERE transaction_type = 'BUY'), 0)
    - coalesce(sum(amount) FILTER (WHERE transaction_type = 'SELL'), 0)   AS net_invested,
  count(*)::int                                                           AS trade_count
FROM transactions
WHERE status = 'SETTLED' AND transaction_type IN ('BUY', 'SELL')
GROUP BY 1;

-- Goals with funded percentage and consistency flags.
CREATE VIEW v_goal_status AS
SELECT
  g.*,
  round(100 * g.current_funded_amount / g.target_amount, 2)           AS funded_pct,
  (g.target_date < current_date
     AND g.current_funded_amount < g.target_amount)                  AS is_overdue,
  (g.current_funded_amount > g.target_amount)                         AS is_overfunded,
  (g.priority = 'HIGH'
     AND g.current_funded_amount < 0.25 * g.target_amount)            AS is_high_priority_underfunded,
  -- Name mentions a different goal type, e.g. type TRAVEL named "Family Education".
  EXISTS (
    SELECT 1
    FROM unnest(ARRAY['RETIREMENT', 'EDUCATION', 'HOME_PURCHASE', 'EMERGENCY_FUND', 'WEALTH_CREATION', 'TRAVEL']) AS t(goal_type)
    WHERE t.goal_type <> g.goal_type
      AND lower(g.goal_name) LIKE '%' || lower(replace(t.goal_type, '_', ' ')) || '%'
  )                                                                   AS is_name_type_mismatch
FROM goals g;

-- Data-quality and reconciliation exceptions, one row per finding.
CREATE VIEW v_data_quality_exceptions AS
SELECT 'TRADE_BEFORE_ACCOUNT_OPENED' AS exception_type,
       'transaction'                 AS entity,
       t.transaction_id              AS entity_id,
       a.customer_id,
       format('trade_date %s is before account %s opened on %s', t.trade_date, a.account_id, a.opened_at) AS detail
FROM transactions t
JOIN accounts a ON a.account_id = t.account_id
WHERE t.trade_date < a.opened_at
UNION ALL
SELECT 'ACTIVITY_ON_CLOSED_ACCOUNT', 'transaction', t.transaction_id, a.customer_id,
       format('%s on %s account %s', t.transaction_type, a.status, a.account_id)
FROM transactions t
JOIN accounts a ON a.account_id = t.account_id
WHERE a.status = 'CLOSED'
UNION ALL
SELECT 'IMPORT_REJECT:' || r.reason_code, b.dataset, r.record_key, NULL,
       format('%s line %s: %s', b.file_name, r.line_number, r.reasons -> 0 ->> 'message')
FROM import_rejects r
JOIN import_batches b ON b.batch_id = r.batch_id;

-- migrate:down

DROP VIEW v_data_quality_exceptions;
DROP VIEW v_goal_status;
DROP VIEW v_monthly_net_flows;
DROP VIEW v_asset_allocation;
DROP VIEW v_customer_portfolio;
DROP VIEW v_account_valuation;
DROP VIEW v_positions;
DROP VIEW v_latest_risk_profile;
