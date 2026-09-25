# Architecture diagrams

Mermaid sources for every diagram in the architecture report
([`../architecture-report.pdf`](../architecture-report.pdf)). GitHub renders them
below; `cd docs/report && npm install && npm run diagrams && npm run build && npm run pdf`
regenerates the PNGs and the report.

## System context

Source: [`system-context.mmd`](system-context.mmd)

```mermaid
flowchart LR
  viewer["Wealth / service user<br/>(VIEWER)"]
  admin["Operations administrator<br/>(ADMIN)"]
  reviewer["Engineering reviewer"]
  csv[("Daily CSV files<br/>(synthetic)")]

  subgraph host["Local host · Docker Compose"]
    direction LR
    web["web<br/>nginx: SPA + reverse proxy"]
    api["api<br/>Fastify REST /api/v1"]
    db[("PostgreSQL 17")]
  end

  gh["GitHub<br/>repo + Actions CI"]

  viewer -- "HTTPS/HTTP · browser" --> web
  admin -- "upload CSV" --> web
  csv -. "file" .-> admin
  web -- "/api/*" --> api
  api -- "SQL (Kysely, pooled)" --> db
  reviewer -- "Swagger /api/docs" --> web
  reviewer -- "code, PRs, CI runs" --> gh
  gh -. "lint · test · build ·<br/>docker smoke test" .-> host
```

## Components and data-access boundary

Source: [`components.mmd`](components.mmd)

```mermaid
flowchart LR
  subgraph web["apps/web · React 19 SPA"]
    direction TB
    router["app/router · lazy routes<br/>RequireAuth (role guard)"]
    features["features/<br/>auth · customers · customer ·<br/>goals · admin"]
    query["TanStack Query hooks<br/>(features/*/api.ts)"]
    ui["components/ui wrappers<br/>(only place importing Base UI)"]
    libweb["lib: api client · format ·<br/>useUrlState · form errors"]
    router --> features --> query --> libweb
    features --> ui
  end

  shared["packages/shared<br/>Zod contracts + types"]

  subgraph api["apps/api · Fastify"]
    direction TB
    plugins["plugins: error model · auth (JWT cookie,<br/>requireRole) · rate limit · Swagger"]
    routes["modules/*/routes<br/>HTTP, schemas, status codes"]
    services["services<br/>business rules (goals)"]
    repos["repositories<br/>Kysely queries → DTOs"]
    pipeline["imports/ pipeline<br/>parse → validate → stage → merge"]
    plugins --> routes --> services --> repos
    routes --> repos
    routes --> pipeline
  end

  subgraph pg["PostgreSQL"]
    tables["tables + constraints"]
    views["views: v_positions · v_account_valuation ·<br/>v_customer_portfolio · v_asset_allocation ·<br/>v_goal_status · v_monthly_net_flows ·<br/>v_data_quality_exceptions"]
  end

  libweb -- "fetch /api/v1 (same origin)" --> plugins
  shared -. "types" .-> query
  shared -. "validation + OpenAPI" .-> routes
  repos --> views
  repos --> tables
  pipeline --> tables
```

## Entity-relationship diagram

Source: [`erd.mmd`](erd.mmd)

```mermaid
erDiagram
  customers ||--o{ accounts : "owns"
  customers ||--o{ risk_profiles : "assessed (latest via view)"
  customers ||--o{ goals : "saves for"
  accounts ||--o{ holdings : "snapshot positions"
  accounts ||--o{ transactions : "ledger"
  instruments ||--o{ holdings : "priced by"
  instruments ||--o{ transactions : "traded"
  users |o--o{ import_batches : "uploaded (null = seed)"
  import_batches ||--o{ import_rejects : "rejected rows"

  customers {
    text customer_id PK "C0001"
    text email UK "lower(email) unique"
    date date_of_birth "CHECK < onboarded_at"
    text kyc_status "VERIFIED / PENDING / REVIEW"
    text segment "Mass / Affluent / HNI"
  }
  accounts {
    text account_id PK "A00001"
    text customer_id FK "indexed"
    text account_type "BROKERAGE / MUTUAL_FUND / RETIREMENT"
    text status "ACTIVE / DORMANT / CLOSED"
  }
  instruments {
    text instrument_id PK "I0001"
    text symbol UK
    text asset_class "EQUITY / ETF / MUTUAL_FUND / BOND / REIT / GSEC"
    numeric last_price "CHECK > 0"
    date price_as_of
  }
  holdings {
    text account_id PK,FK
    text instrument_id PK,FK "indexed"
    date snapshot_date PK
    numeric quantity "CHECK > 0"
    numeric avg_cost "CHECK >= 0"
  }
  transactions {
    text transaction_id PK "T0000001"
    text account_id FK "idx (account_id, trade_date DESC, id DESC)"
    text instrument_id FK "indexed"
    text transaction_type "BUY / SELL / DIVIDEND / FEE"
    date trade_date
    numeric amount "CHECK > 0"
    text status "SETTLED / PENDING / REVERSED; partial idx <> SETTLED"
  }
  risk_profiles {
    text customer_id PK,FK
    date assessed_at PK
    smallint risk_score "CHECK 0..100"
    text risk_level
  }
  goals {
    text goal_id PK "G00001, sequence"
    text customer_id FK "indexed"
    numeric target_amount "CHECK > 0"
    numeric current_funded_amount "CHECK >= 0"
    date target_date
    text priority "LOW / MEDIUM / HIGH"
  }
  users {
    bigint user_id PK
    text email UK
    text password_hash "scrypt"
    text role "VIEWER / ADMIN"
  }
  import_batches {
    bigint batch_id PK
    text dataset
    text file_sha256 "UNIQUE (dataset, sha256)"
    int accepted_rows "CHECK accepted + rejected = total"
    bigint uploaded_by FK
  }
  import_rejects {
    bigint batch_id PK,FK
    int line_number PK
    text reason_code "indexed"
    jsonb reasons
    jsonb raw_row
  }
```

## Local deployment (Docker Compose)

Source: [`deployment.mmd`](deployment.mmd)

```mermaid
flowchart LR
  browser["Browser"]

  subgraph compose["Docker Compose · network finpilot_default"]
    direction LR
    web["web · nginx-unprivileged<br/>:8080 → host 127.0.0.1:8088<br/>SPA + security headers<br/>/api/* proxy, X-Request-Id"]
    api["api · node:24-alpine (non-root)<br/>:3000 (not published)<br/>healthcheck GET /api/v1/health"]
    migrate["migrate · one-off job<br/>dbmate up → seed → exit 0"]
    db[("db · postgres:17-alpine<br/>:5432 → host 127.0.0.1:5433<br/>volume pgdata")]
  end

  env[".env (git-ignored)<br/>JWT_SECRET, DB credentials,<br/>demo passwords"]

  browser -- "http://localhost:8088" --> web
  web -- "http://api:3000" --> api
  api --> db
  migrate --> db
  env -. "compose variables" .-> compose

  db -. "1 · healthy" .-> migrate
  migrate -. "2 · completed successfully" .-> api
  api -. "3 · healthy" .-> web
```

## Workflow: login

Source: [`seq-login.mmd`](seq-login.mmd)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as SPA (LoginPage)
  participant N as nginx
  participant A as API /auth/login
  participant D as PostgreSQL

  U->>W: email + password, submit
  W->>W: validate with shared Zod schema (loginRequest)
  W->>N: POST /api/v1/auth/login (JSON)
  N->>A: proxy + X-Request-Id
  A->>A: rate limit (10/min per client IP)
  A->>D: SELECT user WHERE lower(email) = $1
  D-->>A: user row (or none)
  A->>A: scrypt verify, constant time<br/>(dummy hash if user unknown)
  alt credentials valid
    A-->>W: 200 {user} + Set-Cookie finpilot_session<br/>(JWT, httpOnly, SameSite=Strict, Path=/api, 8 h)
    W->>W: cache session, navigate to ?next (same-app paths only)
  else invalid
    A-->>W: 401 UNAUTHENTICATED "Invalid email or password"
    W->>U: show message
  end
  Note over W,A: Every later request carries the cookie, and any 401 clears the cached session and returns to login.
```

## Workflow: customer portfolio read

Source: [`seq-portfolio.mmd`](seq-portfolio.mmd)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as SPA (OverviewPage)
  participant Q as TanStack Query cache
  participant A as API
  participant D as PostgreSQL

  U->>W: open /customers/C0026
  W->>Q: usePortfolio("C0026")
  alt cached and fresh (< 30 s)
    Q-->>W: cached portfolio
  else
    Q->>A: GET /api/v1/customers/C0026/portfolio (cookie)
    A->>A: verify JWT (onRequest) · validate params (Zod)
    A->>D: SELECT 1 FROM customers WHERE customer_id = $1
    alt unknown customer
      A-->>Q: 404 NOT_FOUND
    else
      par 4 independent queries, no N+1
        A->>D: v_customer_portfolio (totals, dates)
        A->>D: v_account_valuation (per account)
        A->>D: v_asset_allocation (per class, weight %)
        A->>D: v_positions (market value, P/L)
      end
      D-->>A: rows (NUMERIC as strings)
      A->>A: map snake_case → DTO, serialise against response schema
      A-->>Q: 200 Portfolio JSON
    end
    Q-->>W: data
  end
  W->>U: value, P/L, freshness dates, donut + table, accounts
```

## Workflow: goal update

Source: [`seq-goal-update.mmd`](seq-goal-update.mmd)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as SPA (GoalDialog)
  participant A as API PATCH /goals/:goalId
  participant S as goals.service
  participant D as PostgreSQL

  U->>W: edit fields, Save changes
  W->>W: validate with shared goalCreate schema
  alt client validation fails
    W->>U: field errors (no request)
  else
    W->>W: diff against current goal: send changed fields only
    W->>A: PATCH {currentFundedAmount: "300000"}
    A->>A: auth · Zod body (goalUpdate) → 400 with field details if invalid
    A->>S: editGoal(goalId, changes)
    S->>D: SELECT FROM v_goal_status WHERE goal_id = $1
    alt not found
      S-->>A: 404 NOT_FOUND
    else target date changed to the past
      S-->>A: 422 UNPROCESSABLE, details[targetDate]
    else
      S->>D: UPDATE goals SET … , updated_at = now() (parameterised)
      Note right of D: CHECK target > 0, funded >= 0<br/>as last line of defence
      S->>D: SELECT FROM v_goal_status (funded %, flags)
      S-->>A: updated goal
      A->>A: log "goal updated" {goalId, userId, fields, reqId}
      A-->>W: 200 Goal
      W->>W: invalidate goals query → list refreshes, toast
    end
  end
```

## Workflow: CSV import

Source: [`seq-import.mmd`](seq-import.mmd)

```mermaid
sequenceDiagram
  autonumber
  actor Ad as Admin
  participant W as SPA (ImportPage)
  participant A as API /admin/imports/transactions
  participant P as import pipeline
  participant D as PostgreSQL

  Ad->>W: choose CSV
  W->>W: check .csv, size ≤ 5 MB, count rows
  W->>A: POST text/csv ?fileName=… (cookie)
  A->>A: auth · requireRole(ADMIN) → 403 otherwise
  A->>P: importCsv(dataset, content, user)
  P->>P: SHA-256 of file · parse CSV · check header (→ 422 if wrong)
  P->>D: BEGIN · pg_advisory_xact_lock('import:transactions')
  P->>D: batch with same (dataset, sha256)?
  alt already imported
    D-->>P: previous batch
    P-->>A: ALREADY_IMPORTED (nothing written)
    A-->>W: 200 + original counts
  else new file
    P->>P: validate each row (types, enums, dates, amount rules, future date)
    P->>P: in-file duplicates: exact → DUPLICATE_ROW, different → CONFLICTING_DUPLICATE
    P->>D: CREATE TEMP TABLE import_staging … ON COMMIT DROP · INSERT valid rows
    P->>D: set-based checks: unknown account/instrument, key already in ledger
    P->>D: DELETE rejected from staging · INSERT INTO transactions SELECT … FROM staging
    P->>D: INSERT import_batches (counts) · INSERT import_rejects (reasons, raw row)
    P->>D: COMMIT (all or nothing)
    P-->>A: IMPORTED, counts, rejects
    A->>A: log "import completed" {batchId, counts, userId}
    A-->>W: 201 + counts + first 200 rejects
  end
  W->>Ad: accepted / rejected, reason per row, CSV download, history
```

## CI/CD pipeline

Source: [`cicd.mmd`](cicd.mmd)

```mermaid
flowchart LR
  dev["Developer push /<br/>pull request"] --> gha

  subgraph gha["GitHub Actions · CI workflow"]
    direction LR
    subgraph job1["job: build-and-test (Postgres 17 service)"]
      direction TB
      i["pnpm install --frozen-lockfile"] --> f["Prettier check"] --> l["ESLint"] --> t["TypeScript"]
      t --> au["pnpm audit (high/critical)"] --> m["migrations: up → roll back all → up"]
      m --> cg["kysely-codegen --verify"] --> tests["Vitest: API + web<br/>(real database)"] --> b["build"]
    end
    subgraph job2["job: docker-stack"]
      direction TB
      e[".env from example<br/>(random JWT secret)"] --> up["docker compose up --build --wait"]
      up --> smoke["scripts/smoke-test.sh<br/>through nginx"] --> idem["restart: migrate + seed<br/>= ALREADY_IMPORTED"] --> down["compose down -v"]
    end
    job1 --> job2
  end

  gha -- "any step fails" --> red["run fails · PR blocked"]
  gha -- "all green" --> green["merge to main"]
  green -. "production path (documented):<br/>push images → staging → approve → prod" .-> prod["registry / deploy"]
  dep["Dependabot weekly PRs"] --> gha
```
