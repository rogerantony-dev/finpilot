-- migrate:up

-- Unrealised P/L was rounded independently of market value and cost basis, so
-- totals could differ by a paisa (cost + P/L ≠ market value). Define it as
-- rounded market value minus rounded cost basis: every level then adds up exactly.
CREATE OR REPLACE VIEW v_positions AS
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
  round(h.quantity * i.last_price, 2) - round(h.quantity * h.avg_cost, 2) AS unrealised_pnl
FROM holdings h
JOIN accounts a    ON a.account_id = h.account_id
JOIN instruments i ON i.instrument_id = h.instrument_id
WHERE h.snapshot_date = (SELECT max(snapshot_date) FROM holdings);

-- migrate:down

CREATE OR REPLACE VIEW v_positions AS
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
