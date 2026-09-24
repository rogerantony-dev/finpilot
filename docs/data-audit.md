# Data-quality audit of the supplied CSVs

Audit run against the raw files (not edited). Reference dates: snapshot and
price date `2026-09-18`.

## Deliberate anomalies (7 rows, all appended at the end of their files)

| #   | File              | Row                                               | Problem                                                                   | Handling                                                                                                                                                                |
| --- | ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | transactions      | `T0000026` (second copy, line 4551)               | Duplicate primary key; both rows byte-identical                           | Unique key on `transaction_id`; first copy loaded, second **rejected** `DUPLICATE_ID`. A duplicate ID with _different_ contents would be reported as a conflict.        |
| 2   | transactions      | `T0004551` → `I9999`                              | Unknown instrument (invalid FK)                                           | **Rejected** `UNKNOWN_INSTRUMENT`, stored in `import_rejects`                                                                                                           |
| 3   | transactions      | `T0004552` FEE, amount `-75`                      | Negative amount; all other amounts are positive with sign implied by type | **Rejected** `NEGATIVE_AMOUNT`; backed by `CHECK (amount > 0)`. Not auto-corrected: it may be a refund and the rule would be a guess.                                   |
| 4   | transactions      | `T0004553` dated `2027-01-05`, PENDING            | Future trade date; price 210 vs last price 2371                           | **Rejected** `FUTURE_TRADE_DATE` (trade_date > import date)                                                                                                             |
| 5–7 | holdings_snapshot | (A00145, I0036), (A00146, I0010), (A00147, I0049) | Exact duplicate positions for the same snapshot date                      | PK `(account_id, instrument_id, snapshot_date)`; exact copies **de-duplicated and logged**. Conflicting duplicates would reject both rows to avoid double-counting AUM. |

Expected result of importing `transactions.csv`: **4,550 imported, 4 rejected**.

## Cross-file inconsistencies (data-generation artefacts: flagged, not rejected)

- **Transactions do not reconcile to holdings.** Netting settled BUY/SELL gives
  negative quantities for 1,187 of 3,069 account–instrument pairs; only 225 of
  982 holdings appear in transactions at all. **Decision:** the holdings
  snapshot is the source of truth for positions; transactions are an activity
  ledger only.
- **1,069 trades dated before their account's `opened_at`** (71 accounts).
  Rejecting would discard ~23% of the ledger. Imported and surfaced in a
  reconciliation-exceptions view.
- **Activity on non-active accounts:** 116 transactions on CLOSED and 197 on
  DORMANT accounts. The 12 accounts with no holdings are exactly the
  CLOSED/DORMANT ones. Allowed; shown with a status badge.
- **`goal_name` vs `goal_type` mismatch** (e.g. WEALTH_CREATION named
  "Long-term Retirement"). Names appear randomly generated. Soft warning only.

## Checks that passed

- No orphan FKs other than `I9999`; no duplicate customer IDs, emails or phones.
- All enum values valid; all dates parse; no minors; city↔state consistent.
- Every BUY/SELL satisfies `quantity × price = amount`; DIVIDEND/FEE rows have
  quantity = price = 0.
- Goals: none overdue (earliest target 2027-08), none over-funded, no target ≤ 0.
  Overdue/inconsistent checks therefore only fire for goals created or edited
  through the app and are covered by tests.
- Risk scores fall in non-overlapping bands per level: Conservative 18–34,
  Moderate 35–53, Growth 55–74, Aggressive 75–92.
- Single price/snapshot date (2026-09-18) and single currency (INR).

## Parsing notes

- Files use CRLF line endings.
- Quantities up to 3 decimals, prices 2 decimals → `NUMERIC`, never floats.
- `sector` blank for all 48 non-equity instruments → stored as `NULL`.

## Useful facts for demos / SQL tasks

- 12 HIGH-priority goals are below 25% funded.
- `A00001` (CLOSED, no holdings) holds the duplicated transaction `T0000026`.
