-- migrate:up

-- Enumerations are TEXT + CHECK rather than PostgreSQL ENUM types: values are
-- visible in the table definition and adding one is a simple constraint swap.
-- Money is NUMERIC(18,2), prices/costs NUMERIC(18,4), quantities NUMERIC(18,6):
-- exact decimals, never floating point.

CREATE TABLE customers (
  customer_id    TEXT PRIMARY KEY CHECK (customer_id ~ '^C[0-9]{4,}$'),
  full_name      TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  email          TEXT NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone          TEXT NOT NULL CHECK (phone ~ '^\+[0-9]{8,15}$'),
  city           TEXT NOT NULL,
  state          TEXT NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  date_of_birth  DATE NOT NULL,
  onboarded_at   DATE NOT NULL,
  kyc_status     TEXT NOT NULL CHECK (kyc_status IN ('VERIFIED', 'PENDING', 'REVIEW')),
  segment        TEXT NOT NULL CHECK (segment IN ('Mass', 'Affluent', 'HNI')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_dob_before_onboarding CHECK (date_of_birth < onboarded_at)
);
-- Case-insensitive uniqueness for email.
CREATE UNIQUE INDEX customers_email_key ON customers (lower(email));

-- One row per assessment, so history can be kept; "latest" is a view.
CREATE TABLE risk_profiles (
  customer_id     TEXT NOT NULL REFERENCES customers (customer_id),
  assessed_at     DATE NOT NULL,
  risk_score      SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level      TEXT NOT NULL CHECK (risk_level IN ('Conservative', 'Moderate', 'Growth', 'Aggressive')),
  horizon_years   SMALLINT NOT NULL CHECK (horizon_years BETWEEN 0 AND 100),
  liquidity_need  TEXT NOT NULL CHECK (liquidity_need IN ('LOW', 'MEDIUM', 'HIGH')),
  PRIMARY KEY (customer_id, assessed_at)
);

CREATE TABLE accounts (
  account_id     TEXT PRIMARY KEY CHECK (account_id ~ '^A[0-9]{5,}$'),
  customer_id    TEXT NOT NULL REFERENCES customers (customer_id),
  account_type   TEXT NOT NULL CHECK (account_type IN ('BROKERAGE', 'MUTUAL_FUND', 'RETIREMENT')),
  provider       TEXT NOT NULL,
  opened_at      DATE NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DORMANT', 'CLOSED')),
  base_currency  TEXT NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$')
);
-- Portfolio and transaction reads start from "accounts of customer X".
CREATE INDEX accounts_customer_id_idx ON accounts (customer_id);

CREATE TABLE instruments (
  instrument_id    TEXT PRIMARY KEY CHECK (instrument_id ~ '^I[0-9]{4,}$'),
  symbol           TEXT NOT NULL UNIQUE,
  instrument_name  TEXT NOT NULL,
  asset_class      TEXT NOT NULL CHECK (asset_class IN ('EQUITY', 'ETF', 'MUTUAL_FUND', 'BOND', 'REIT', 'GSEC')),
  sector           TEXT,
  exchange         TEXT NOT NULL CHECK (exchange IN ('NSE', 'BSE', 'OTC')),
  currency         TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  last_price       NUMERIC(18, 4) NOT NULL CHECK (last_price > 0),
  price_as_of      DATE NOT NULL,
  risk_band        TEXT NOT NULL CHECK (risk_band IN ('LOW', 'MEDIUM', 'HIGH')),
  -- Sector only applies to equities.
  CONSTRAINT instruments_sector_equity_only CHECK (sector IS NULL OR asset_class = 'EQUITY')
);

-- End-of-day positions. One row per account, instrument and snapshot date:
-- the primary key is what rejects duplicate positions.
CREATE TABLE holdings (
  account_id     TEXT NOT NULL REFERENCES accounts (account_id),
  instrument_id  TEXT NOT NULL REFERENCES instruments (instrument_id),
  snapshot_date  DATE NOT NULL,
  quantity       NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
  avg_cost       NUMERIC(18, 4) NOT NULL CHECK (avg_cost >= 0),
  PRIMARY KEY (account_id, instrument_id, snapshot_date)
);
-- "Top instruments by distinct holders" and instrument look-ups.
CREATE INDEX holdings_instrument_id_idx ON holdings (instrument_id);

CREATE TABLE transactions (
  transaction_id    TEXT PRIMARY KEY CHECK (transaction_id ~ '^T[0-9]{7,}$'),
  account_id        TEXT NOT NULL REFERENCES accounts (account_id),
  instrument_id     TEXT NOT NULL REFERENCES instruments (instrument_id),
  transaction_type  TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'DIVIDEND', 'FEE')),
  trade_date        DATE NOT NULL,
  quantity          NUMERIC(18, 6) NOT NULL CHECK (quantity >= 0),
  price             NUMERIC(18, 4) NOT NULL CHECK (price >= 0),
  -- Always positive; direction is implied by transaction_type.
  amount            NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  status            TEXT NOT NULL CHECK (status IN ('SETTLED', 'PENDING', 'REVERSED')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Trades carry units and a price; cash events (dividend, fee) carry neither.
  CONSTRAINT transactions_shape_by_type CHECK (
    (transaction_type IN ('BUY', 'SELL') AND quantity > 0 AND price > 0)
    OR (transaction_type IN ('DIVIDEND', 'FEE') AND quantity = 0 AND price = 0)
  )
);
-- Transaction list: WHERE account_id IN (...) [AND trade_date BETWEEN ...]
-- ORDER BY trade_date DESC, transaction_id DESC. Serves filter, sort and paging.
CREATE INDEX transactions_account_date_idx
  ON transactions (account_id, trade_date DESC, transaction_id DESC);
-- Instrument filter and FK look-ups.
CREATE INDEX transactions_instrument_id_idx ON transactions (instrument_id);
-- Partial index: only the few PENDING/REVERSED rows (~5%), for the
-- "open items" status filter and exception reporting.
CREATE INDEX transactions_not_settled_idx
  ON transactions (account_id, trade_date DESC)
  WHERE status <> 'SETTLED';

CREATE SEQUENCE goal_id_seq;

CREATE TABLE goals (
  goal_id                TEXT PRIMARY KEY
                         DEFAULT 'G' || lpad(nextval('goal_id_seq')::text, 5, '0')
                         CHECK (goal_id ~ '^G[0-9]{5,}$'),
  customer_id            TEXT NOT NULL REFERENCES customers (customer_id),
  goal_type              TEXT NOT NULL CHECK (goal_type IN ('RETIREMENT', 'EDUCATION', 'HOME_PURCHASE', 'EMERGENCY_FUND', 'WEALTH_CREATION', 'TRAVEL')),
  goal_name              TEXT NOT NULL CHECK (length(trim(goal_name)) BETWEEN 1 AND 100),
  target_amount          NUMERIC(18, 2) NOT NULL CHECK (target_amount > 0),
  current_funded_amount  NUMERIC(18, 2) NOT NULL CHECK (current_funded_amount >= 0),
  target_date            DATE NOT NULL,
  priority               TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER SEQUENCE goal_id_seq OWNED BY goals.goal_id;
CREATE INDEX goals_customer_id_idx ON goals (customer_id);

-- migrate:down

DROP TABLE goals;
DROP TABLE transactions;
DROP TABLE holdings;
DROP TABLE instruments;
DROP TABLE accounts;
DROP TABLE risk_profiles;
DROP TABLE customers;
