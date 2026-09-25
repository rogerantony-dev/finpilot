# Database guide: every table, every field, every calculation

PostgreSQL database `finpilot` (see `db/migrations/`). There are two kinds of
objects:

- **Tables** store data. Most rows come from the supplied CSVs via the import
  pipeline; a few columns are filled in by the database or the app.
- **Views** store no data. They are saved queries that **calculate** values
  (market value, P/L, funded %) every time they are read, so there is exactly
  one definition of each number.

Conventions: money is `NUMERIC(18,2)`, prices/costs `NUMERIC(18,4)`,
quantities `NUMERIC(18,6)` (exact decimals, never floating point); dates are
`DATE`; "CHECK" means the database refuses rows that break the rule.

---

## Part 1 · Tables

### `customers` (120 rows, from `customers.csv`)

| Column          | Meaning                            | Where it comes from / rule                         |
| --------------- | ---------------------------------- | -------------------------------------------------- |
| `customer_id`   | Customer ID, e.g. `C0001`          | CSV. Primary key; must look like `C` + digits      |
| `full_name`     | Display name                       | CSV. Must not be blank                             |
| `email`         | Email address                      | CSV. Must look like an email; unique ignoring case |
| `phone`         | Phone number                       | CSV. `+` followed by 8–15 digits                   |
| `city`, `state` | Location; state is a 2-letter code | CSV                                                |
| `date_of_birth` | Birth date                         | CSV. Must be before `onboarded_at`                 |
| `onboarded_at`  | When they joined the platform      | CSV. Cannot be in the future (import check)        |
| `kyc_status`    | Identity verification status       | CSV. `VERIFIED`, `PENDING` or `REVIEW`             |
| `segment`       | Customer tier                      | CSV. `Mass`, `Affluent` or `HNI`                   |
| `created_at`    | When the row was inserted          | Database, automatically `now()`                    |

### `accounts` (167 rows, from `accounts.csv`)

| Column          | Meaning                                             | Rule                                    |
| --------------- | --------------------------------------------------- | --------------------------------------- |
| `account_id`    | e.g. `A00001`                                       | Primary key                             |
| `customer_id`   | Owner                                               | Must exist in `customers` (foreign key) |
| `account_type`  | `BROKERAGE`, `MUTUAL_FUND` or `RETIREMENT`          | CHECK                                   |
| `provider`      | Firm holding the account, e.g. NorthStar Securities | CSV                                     |
| `opened_at`     | Open date                                           | Not in the future                       |
| `status`        | `ACTIVE`, `DORMANT` or `CLOSED`                     | CHECK                                   |
| `base_currency` | 3-letter currency code (all `INR`)                  | CHECK                                   |

A customer can have several accounts (79 have one, 35 have two, 6 have three).

### `instruments` (80 rows, from `instruments.csv`): the price list

| Column            | Meaning                                                   | Rule                                    |
| ----------------- | --------------------------------------------------------- | --------------------------------------- |
| `instrument_id`   | e.g. `I0001`                                              | Primary key                             |
| `symbol`          | Short code, e.g. `EQ001`                                  | Unique                                  |
| `instrument_name` | e.g. "FinPilot Equity 1"                                  | CSV                                     |
| `asset_class`     | `EQUITY`, `ETF`, `MUTUAL_FUND`, `BOND`, `REIT`, `GSEC`    | CHECK. Drives the allocation chart      |
| `sector`          | e.g. Technology                                           | Only allowed for EQUITY; blank → `NULL` |
| `exchange`        | `NSE`, `BSE` or `OTC`                                     | CHECK                                   |
| `currency`        | `INR`                                                     | CHECK                                   |
| `last_price`      | **Latest price per unit**, used for every valuation       | Must be > 0                             |
| `price_as_of`     | Date of that price (2026-09-18); shown as "Prices as of…" | CSV                                     |
| `risk_band`       | `LOW`, `MEDIUM`, `HIGH`                                   | CHECK                                   |

### `holdings` (982 rows, from `holdings_snapshot.csv`): what each account owns

| Column          | Meaning                           | Rule                        |
| --------------- | --------------------------------- | --------------------------- |
| `account_id`    | Which account                     | Foreign key → `accounts`    |
| `instrument_id` | What it holds                     | Foreign key → `instruments` |
| `snapshot_date` | Date of the snapshot (2026-09-18) | Not in the future           |
| `quantity`      | Units held                        | Must be > 0                 |
| `avg_cost`      | Average price paid per unit       | Must be ≥ 0                 |

The primary key is **(account_id, instrument_id, snapshot_date)**: one row per
account, instrument and day. That key is what rejected the 3 duplicate
positions in the CSV (985 rows in the file → 982 stored).

**This table is the source of truth for "what the customer owns".**

### `transactions` (4,550 seeded + imports, from `transactions.csv`): activity history

| Column             | Meaning                            | Rule                                                                                                                                    |
| ------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `transaction_id`   | e.g. `T0000001`                    | Primary key (rejected the duplicate `T0000026`)                                                                                         |
| `account_id`       | Which account                      | Foreign key → `accounts`                                                                                                                |
| `instrument_id`    | Which instrument                   | Foreign key → `instruments` (rejected `I9999`)                                                                                          |
| `transaction_type` | `BUY`, `SELL`, `DIVIDEND` or `FEE` | CHECK                                                                                                                                   |
| `trade_date`       | When it happened                   | Not in the future (rejected 2027-01-05)                                                                                                 |
| `quantity`         | Units traded                       | BUY/SELL > 0; DIVIDEND/FEE = 0                                                                                                          |
| `price`            | Price per unit                     | BUY/SELL > 0; DIVIDEND/FEE = 0                                                                                                          |
| `amount`           | Money involved                     | Always > 0 (rejected the −75 fee); direction comes from the type. For BUY/SELL, import checks `quantity × price ≈ amount` (within 0.05) |
| `status`           | `SETTLED`, `PENDING` or `REVERSED` | CHECK. Pending/reversed are highlighted in the UI                                                                                       |
| `created_at`       | When the row was inserted          | Database `now()`                                                                                                                        |

Transactions are shown as history only; they are **not** used to compute
positions (in the supplied data they do not add up to the holdings).

### `risk_profiles` (120 rows, from `risk_profiles.csv`)

| Column           | Meaning                                                                                         | Rule                                    |
| ---------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| `customer_id`    | Whose assessment                                                                                | Foreign key → `customers`               |
| `assessed_at`    | Assessment date                                                                                 | Part of the primary key (keeps history) |
| `risk_score`     | 0–100, higher = more risk tolerance                                                             | CHECK 0–100                             |
| `risk_level`     | `Conservative` (18–34), `Moderate` (35–53), `Growth` (55–74), `Aggressive` (75–92) in this data | CHECK                                   |
| `horizon_years`  | How many years they plan to invest                                                              | 0–100                                   |
| `liquidity_need` | How soon they may need cash: `LOW`, `MEDIUM`, `HIGH`                                            | CHECK                                   |

### `goals` (177 from `goals.csv` + goals created in the app)

| Column                      | Meaning                                                                                   | Rule                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `goal_id`                   | e.g. `G00001`                                                                             | CSV for imported goals. **App-created goals get the next number from a sequence** (`G00178`, `G00179`, …); after importing, the sequence is moved past the highest imported ID |
| `customer_id`               | Whose goal                                                                                | Foreign key                                                                                                                                                                    |
| `goal_type`                 | `RETIREMENT`, `EDUCATION`, `HOME_PURCHASE`, `EMERGENCY_FUND`, `WEALTH_CREATION`, `TRAVEL` | CHECK                                                                                                                                                                          |
| `goal_name`                 | Free text, 1–100 characters                                                               | CHECK                                                                                                                                                                          |
| `target_amount`             | Amount needed                                                                             | Must be > 0                                                                                                                                                                    |
| `current_funded_amount`     | Amount saved so far                                                                       | Must be ≥ 0                                                                                                                                                                    |
| `target_date`               | Deadline                                                                                  | App refuses to _set_ a past date                                                                                                                                               |
| `priority`                  | `LOW`, `MEDIUM`, `HIGH`                                                                   | CHECK                                                                                                                                                                          |
| `created_at` / `updated_at` | Timestamps                                                                                | Database `now()`; `updated_at` reset by the app on every edit                                                                                                                  |

### `users` (2 rows, created by the seed)

| Column          | Meaning                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`       | Auto-incrementing number                                                                                                                                          |
| `email`         | Login email, unique ignoring case                                                                                                                                 |
| `full_name`     | Shown in the sidebar (Priya Menon, Arjun Rao)                                                                                                                     |
| `password_hash` | **Not the password.** `scrypt$N$r$p$salt$hash`: a random salt plus the scrypt hash of the password. Login re-hashes what you type with the same salt and compares |
| `role`          | `VIEWER` or `ADMIN`                                                                                                                                               |
| `created_at`    | Timestamp                                                                                                                                                         |

### `import_batches`: one row per file loaded

| Column                      | How it is filled                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `batch_id`                  | Auto-incrementing number                                                                                                         |
| `dataset`                   | Which kind of file (`transactions`, `holdings`, …)                                                                               |
| `file_name`                 | Name as uploaded                                                                                                                 |
| `file_sha256`               | **Fingerprint of the file's exact bytes.** Unique per dataset, so the same file can never be imported twice → "Already imported" |
| `total_rows`                | Data rows in the file (header excluded)                                                                                          |
| `accepted_rows`             | Rows actually inserted                                                                                                           |
| `rejected_rows`             | Rows set aside; the database checks `accepted + rejected = total`                                                                |
| `uploaded_by`               | User ID of the admin; `NULL` = initial seed                                                                                      |
| `started_at`, `finished_at` | When the import began and completed                                                                                              |

### `import_rejects`: one row per rejected CSV line

| Column        | How it is filled                                                  |
| ------------- | ----------------------------------------------------------------- |
| `batch_id`    | Which import                                                      |
| `line_number` | Line in the file (line 1 is the header)                           |
| `record_key`  | The row's ID if readable, e.g. `T0004551`                         |
| `reason_code` | The first problem found, e.g. `UNKNOWN_REFERENCE` (for filtering) |
| `reasons`     | JSON list of **every** problem: `[{code, field, message}]`        |
| `raw_row`     | JSON copy of the row exactly as it was in the file                |

Reason codes: `REQUIRED`, `INVALID_FORMAT`, `INVALID_ENUM`, `OUT_OF_RANGE`,
`NEGATIVE_AMOUNT`, `FUTURE_DATE`, `INCONSISTENT_ROW`, `DUPLICATE_ROW`,
`CONFLICTING_DUPLICATE`, `ALREADY_EXISTS`, `UNKNOWN_REFERENCE`.

### `schema_migrations`

Written by the migration tool (dbmate): one row per migration file applied.

---

## Part 2 · Views: how every calculated number is made

Worked examples use real data: customer **C0002 (Kabir Singh)** and
instrument **I0014** in account **A00002**: quantity `40.614`, average cost
`₹2,396.36`, latest price `₹2,341.67`.

### `v_positions`: one row per holding, valued

Joins `holdings` + `instruments` (for price and asset class) + `accounts`
(for the owner), for the **latest snapshot date** in `holdings`.

| Field                                           | Formula                                                                         | Example (I0014)                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| `customer_id`, `account_type`, `account_status` | From `accounts`                                                                 | C0002, BROKERAGE, ACTIVE               |
| `symbol`, `instrument_name`, `asset_class`      | From `instruments`                                                              | EQ014, FinPilot Equity 14, EQUITY      |
| `quantity`, `avg_cost`, `snapshot_date`         | From `holdings`                                                                 | 40.614, 2396.36, 2026-09-18            |
| `last_price`, `price_as_of`                     | From `instruments`                                                              | 2341.67, 2026-09-18                    |
| **`cost_basis`**                                | `round(quantity × avg_cost, 2)`: what was paid                                  | 40.614 × 2,396.36 = **₹97,325.77**     |
| **`market_value`**                              | `round(quantity × last_price, 2)`: worth today                                  | 40.614 × 2,341.67 = **₹95,104.59**     |
| **`unrealised_pnl`**                            | `market_value − cost_basis`: profit (+) or loss (−) not yet realised by selling | 95,104.59 − 97,325.77 = **−₹2,221.18** |

P/L is defined as _rounded value minus rounded cost_ (not rounded separately)
so that at every level **cost + P/L = market value exactly**.

The **P/L %** shown in the UI is `unrealised_pnl ÷ cost_basis × 100`
(−2,221.18 ÷ 97,325.77 = −2.28%).

### `v_account_valuation`: one row per account

Every account (even with no holdings) plus the sum of its positions.

| Field                          | Formula                                                  |
| ------------------------------ | -------------------------------------------------------- |
| account columns                | From `accounts`                                          |
| `position_count`               | Number of holdings in the account                        |
| `cost_basis`                   | Sum of the positions' `cost_basis` (0 if none)           |
| `market_value`                 | Sum of the positions' `market_value` (0 if none)         |
| `unrealised_pnl`               | Sum of the positions' `unrealised_pnl` (0 if none)       |
| `snapshot_date`, `price_as_of` | Latest dates among its positions (`NULL` if no holdings) |

Example: account A00002 has 8 positions → market value ₹2,63,088.49, cost
₹2,35,759.39, P/L +₹27,329.10. A closed account with no holdings shows 0.

### `v_customer_portfolio`: one row per customer (their "AUM")

| Field                                          | Formula                              |
| ---------------------------------------------- | ------------------------------------ |
| `account_count`                                | Number of accounts                   |
| `position_count`                               | Sum of the accounts' position counts |
| `cost_basis`, `market_value`, `unrealised_pnl` | Sum over the customer's accounts     |
| `snapshot_date`, `price_as_of`                 | Latest dates across the accounts     |

Example: C0026 (Rohan Kulkarni): 3 accounts, 19 positions, **market value
₹19,53,574.61**, cost ₹19,64,360.97, P/L −₹10,786.36 (the Overview headline).
The UI's return % is `unrealised_pnl ÷ cost_basis × 100` = −0.55%.

### `v_asset_allocation`: one row per customer per asset class

| Field            | Formula                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `market_value`   | Sum of `market_value` of that customer's positions in that class                                                                                                         |
| **`weight_pct`** | `round(100 × class value ÷ customer's total value, 2)`. The total is computed in the same query with a window function (`sum(sum(...)) OVER (PARTITION BY customer_id)`) |

Example C0002: Equity ₹2,01,193.28 ÷ ₹2,63,088.49 = **76.47%**; Mutual fund
21.88%; Bond 1.65%. This feeds the donut chart and its table.

### `v_goal_status`: goals with progress and warnings

All `goals` columns plus:

| Field                              | Formula                                                 | Example                                          |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| **`funded_pct`**                   | `round(100 × current_funded_amount ÷ target_amount, 2)` | G00001: 5,000,753.18 ÷ 6,076,934.41 = **82.29%** |
| **`is_overdue`**                   | `target_date < today` **and** `funded < target`         | Past deadline and not reached                    |
| **`is_overfunded`**                | `funded > target`                                       | Saved more than needed (shown as "Over-funded")  |
| **`is_high_priority_underfunded`** | `priority = HIGH` **and** `funded < 25% of target`      | 12 goals in the data                             |
| **`is_name_type_mismatch`**        | The name contains the words of a _different_ goal type  | Type `TRAVEL` named "Family Education"           |

### `v_latest_risk_profile`

For each customer, the `risk_profiles` row with the **most recent
`assessed_at`** (`DISTINCT ON (customer_id) … ORDER BY assessed_at DESC`).
This is the risk card on the customer page.

### `v_monthly_net_flows`: whole book, per month (SQL task)

Only `SETTLED` `BUY`/`SELL` transactions.

| Field              | Formula                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| `month`            | First day of the trade's month                                                        |
| `buy_amount`       | Sum of BUY amounts that month                                                         |
| `sell_amount`      | Sum of SELL amounts that month                                                        |
| **`net_invested`** | `buy_amount − sell_amount` (positive = more money went into the market than came out) |
| `trade_count`      | Number of trades                                                                      |

### `v_data_quality_exceptions`: suspicious data, one row per finding

| `exception_type`              | When a row appears                                                      |
| ----------------------------- | ----------------------------------------------------------------------- |
| `TRADE_BEFORE_ACCOUNT_OPENED` | `trade_date` earlier than the account's `opened_at` (1,069 in the data) |
| `ACTIVITY_ON_CLOSED_ACCOUNT`  | Transaction on an account whose status is `CLOSED` (114)                |
| `IMPORT_REJECT:<code>`        | Every row in `import_rejects`, with file, line and first message        |

`detail` is a readable sentence built with `format(...)`, e.g. "trade_date
2025-07-08 is before account A00005 opened on 2025-10-07".

---

## Part 3 · Numbers computed outside the database

Only display formatting and two percentages happen in the web app; every
amount comes from the views above.

| Shown as                        | Calculation                                                  | Where               |
| ------------------------------- | ------------------------------------------------------------ | ------------------- |
| P/L % on Overview and Positions | `unrealised_pnl ÷ cost_basis × 100`                          | Web app             |
| ₹19.54 L / ₹5.28 Cr             | Value ÷ 1,00,000 (lakh) or ÷ 1,00,00,000 (crore), 2 decimals | Web app formatting  |
| ₹19,53,574.61                   | Indian digit grouping (`en-IN`)                              | Web app formatting  |
| Import counts                   | Counted while importing, stored in `import_batches`          | API import pipeline |
