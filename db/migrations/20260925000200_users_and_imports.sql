-- migrate:up

CREATE TABLE users (
  user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('VIEWER', 'ADMIN')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- One row per file load. The (dataset, file_sha256) unique key makes loads
-- idempotent: the same file can never be imported twice.
CREATE TABLE import_batches (
  batch_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset        TEXT NOT NULL CHECK (dataset IN ('customers', 'risk_profiles', 'accounts', 'instruments', 'holdings', 'transactions', 'goals')),
  file_name      TEXT NOT NULL,
  file_sha256    TEXT NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  total_rows     INTEGER NOT NULL CHECK (total_rows >= 0),
  accepted_rows  INTEGER NOT NULL CHECK (accepted_rows >= 0),
  rejected_rows  INTEGER NOT NULL CHECK (rejected_rows >= 0),
  uploaded_by    BIGINT REFERENCES users (user_id),  -- NULL for the initial seed
  started_at     TIMESTAMPTZ NOT NULL,
  finished_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_batches_file_once UNIQUE (dataset, file_sha256),
  CONSTRAINT import_batches_counts_add_up CHECK (accepted_rows + rejected_rows = total_rows)
);

-- Row-level rejection reasons, with the original row kept for investigation.
CREATE TABLE import_rejects (
  batch_id     BIGINT NOT NULL REFERENCES import_batches (batch_id) ON DELETE CASCADE,
  line_number  INTEGER NOT NULL CHECK (line_number > 1),  -- line 1 is the header
  record_key   TEXT,                                     -- e.g. the transaction_id, if readable
  reason_code  TEXT NOT NULL,                            -- first/primary reason, for filtering
  reasons      JSONB NOT NULL,                           -- all reasons: [{code, field?, message}]
  raw_row      JSONB NOT NULL,
  PRIMARY KEY (batch_id, line_number)
);
CREATE INDEX import_rejects_reason_code_idx ON import_rejects (reason_code);

-- migrate:down

DROP TABLE import_rejects;
DROP TABLE import_batches;
DROP TABLE users;
