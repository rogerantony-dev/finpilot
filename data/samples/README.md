# Sample import files

Demo files for the admin import screen (`/admin/import`) and
`POST /api/v1/admin/imports/transactions`. They reference real accounts and
instruments from the seeded data. Unlike `data/raw/`, these are ours and may be
changed.

| File                           |  Rows | Expected result                                                                          |
| ------------------------------ | ----: | ---------------------------------------------------------------------------------------- |
| `transactions_2026-09-19.csv`  |    20 | A clean daily file: **20 accepted, 0 rejected** (includes 2 PENDING, 2 DIVIDEND, 1 FEE). |
| `transactions_with_errors.csv` |    17 | **4 accepted, 13 rejected**, one example of each rule (below).                           |
| `../raw/transactions.csv`      | 4,554 | Already loaded by the seed: **"Already imported", nothing changes**.                     |

Uploading any file a second time returns "Already imported" (matched by the
file's SHA-256). To repeat the demo from scratch: `pnpm db:reset`.

## Rows in `transactions_with_errors.csv`

|  Line | Transaction | Result   | Reason                                                       |
| ----: | ----------- | -------- | ------------------------------------------------------------ |
|     2 | T6000001    | accepted |                                                              |
|     3 | T6000002    | accepted |                                                              |
|     4 | T6000003    | accepted | dividend                                                     |
|     5 | T6000004    | rejected | `UNKNOWN_REFERENCE`: account A99999 does not exist           |
|     6 | T6000005    | rejected | `UNKNOWN_REFERENCE`: instrument I8888 does not exist         |
|     7 | T6000006    | rejected | `INVALID_ENUM`: transaction type SWAP                        |
|     8 | T6000007    | rejected | `INVALID_FORMAT`: 2026-02-30 is not a real date              |
|     9 | T6000008    | rejected | `INCONSISTENT_ROW`: amount ≠ quantity × price                |
|    10 | T6000009    | rejected | `NEGATIVE_AMOUNT`: fee of −40                                |
|    11 | T6000010    | rejected | `FUTURE_DATE`: trade dated 2027-03-01                        |
|    12 | T0000001    | rejected | `ALREADY_EXISTS`: already in the ledger; never overwritten   |
| 13–14 | T6000012    | rejected | `CONFLICTING_DUPLICATE`: same ID twice with different values |
|    15 | T6000001    | rejected | `DUPLICATE_ROW`: exact copy of line 2                        |
|    16 | T6000015    | rejected | `REQUIRED`: status missing                                   |
|    17 | T6000016    | accepted | pending buy                                                  |
|    18 | T6000017    | rejected | `INCONSISTENT_ROW`: dividend with quantity and price         |
