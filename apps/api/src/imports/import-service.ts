import { createHash } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { z } from 'zod';
import type { Db } from '../db/index.js';
import type { DB } from '../db/schema.js';
import { parseCsv, type CsvRow } from './csv.js';
import { DATASETS, type DatasetDefinition, type DatasetName } from './datasets.js';
import { REASON, type ReasonCode } from './fields.js';

export interface RejectReason {
  code: ReasonCode;
  field?: string;
  message: string;
}

export interface RejectedRow {
  line: number;
  recordKey: string | null;
  reasons: RejectReason[];
  raw: Record<string, string>;
}

export interface ImportResult {
  status: 'IMPORTED' | 'ALREADY_IMPORTED';
  batchId: string;
  dataset: DatasetName;
  fileName: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  /** Row-level reasons; empty when status is ALREADY_IMPORTED. */
  rejects: RejectedRow[];
}

export interface ImportInput {
  dataset: DatasetName;
  fileName: string;
  content: string;
  uploadedBy?: string | null;
  /** Import date (YYYY-MM-DD); rows dated after it are rejected. Defaults to today (UTC). */
  asOf?: string;
}

type ValidRow = { line: number; data: Record<string, string | null> };

const STAGING = 'import_staging';
const INSERT_CHUNK = 500;

/**
 * Import one CSV file into one dataset. The pipeline:
 *
 *   1. hash the file; if this exact file was imported before, stop (idempotent)
 *   2. parse, check the header, validate every row (types, enums, dates, rules)
 *   3. drop in-file duplicates (exact copies) or reject them (conflicting copies)
 *   4. load valid rows into a temporary staging table
 *   5. in SQL, reject rows with unknown references or keys that already exist
 *   6. merge the remaining rows into the real table
 *   7. record the batch and every rejected row with its reasons
 *
 * Steps 4–7 run in one database transaction: it all commits or nothing does.
 * A per-dataset advisory lock serialises concurrent imports of the same dataset.
 */
export async function importCsv(db: Db, input: ImportInput): Promise<ImportResult> {
  const def: DatasetDefinition = DATASETS[input.dataset];
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const fileSha256 = createHash('sha256').update(input.content).digest('hex');
  const startedAt = new Date();

  // Whole-file problems (bad header, not CSV) throw before anything is written.
  const { rows } = parseCsv(input.content, def.columns);

  return db.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext(${`import:${def.name}`}))`.execute(trx);

    const previous = await trx
      .selectFrom('import_batches')
      .selectAll()
      .where('dataset', '=', def.name)
      .where('file_sha256', '=', fileSha256)
      .executeTakeFirst();
    if (previous) {
      return {
        status: 'ALREADY_IMPORTED',
        batchId: previous.batch_id,
        dataset: def.name,
        fileName: previous.file_name,
        totalRows: previous.total_rows,
        acceptedRows: previous.accepted_rows,
        rejectedRows: previous.rejected_rows,
        rejects: [],
      } satisfies ImportResult;
    }

    const rejects = new Map<number, RejectedRow>();
    const reject = (row: CsvRow, reason: RejectReason) => {
      const existing = rejects.get(row.line);
      if (existing) existing.reasons.push(reason);
      else
        rejects.set(row.line, {
          line: row.line,
          recordKey: keyOf(def, row.values),
          reasons: [reason],
          raw: row.values,
        });
    };

    // Step 2: row validation.
    const schema = def.rowSchema(asOf);
    const valid: ValidRow[] = [];
    for (const row of rows) {
      const parsed = schema.safeParse(row.values);
      if (parsed.success) valid.push({ line: row.line, data: parsed.data });
      else for (const issue of parsed.error.issues) reject(row, toReason(issue));
    }

    // Step 3: duplicates within the file.
    const rowsByLine = new Map(rows.map((r) => [r.line, r]));
    const unique = removeInFileDuplicates(def, valid, (line, reason) =>
      reject(rowsByLine.get(line)!, reason),
    );

    // Step 4: staging table shaped like the target table, dropped at commit.
    await sql`CREATE TEMP TABLE ${sql.id(STAGING)} (LIKE ${sql.table(def.table)} INCLUDING DEFAULTS) ON COMMIT DROP`.execute(
      trx,
    );
    await sql`ALTER TABLE ${sql.id(STAGING)} ADD COLUMN line_number INT NOT NULL`.execute(trx);
    for (let i = 0; i < unique.length; i += INSERT_CHUNK) {
      await insertStaging(trx, def, unique.slice(i, i + INSERT_CHUNK));
    }

    // Step 5: set-based checks in SQL.
    for (const ref of def.references) {
      const { rows: missing } = await sql<{ line_number: number; value: string }>`
        SELECT s.line_number, s.${sql.ref(ref.column)} AS value
        FROM ${sql.id(STAGING)} s
        WHERE NOT EXISTS (
          SELECT 1 FROM ${sql.table(ref.table)} r WHERE r.${sql.ref(ref.refColumn)} = s.${sql.ref(ref.column)}
        )`.execute(trx);
      for (const m of missing) {
        reject(rowsByLine.get(m.line_number)!, {
          code: REASON.UNKNOWN_REFERENCE,
          field: ref.column,
          message: `${ref.label} ${m.value} does not exist`,
        });
      }
    }

    const keyMatch = sql.join(
      def.key.map((k) => sql`t.${sql.ref(k)} = s.${sql.ref(k)}`),
      sql` AND `,
    );
    const { rows: existing } = await sql<{ line_number: number }>`
      SELECT s.line_number FROM ${sql.id(STAGING)} s
      JOIN ${sql.table(def.table)} t ON ${keyMatch}`.execute(trx);
    for (const e of existing) {
      const row = rowsByLine.get(e.line_number)!;
      reject(row, {
        code: REASON.ALREADY_EXISTS,
        field: def.key[0],
        message: `${keyOf(def, row.values)} already exists and will not be overwritten`,
      });
    }

    // Step 6: merge what is left.
    const rejectedLines = [...rejects.keys()];
    if (rejectedLines.length) {
      await sql`DELETE FROM ${sql.id(STAGING)} WHERE line_number = ANY(${rejectedLines})`.execute(
        trx,
      );
    }
    const columns = sql.join(def.columns.map((c) => sql.ref(c)));
    const merged = await sql`
      INSERT INTO ${sql.table(def.table)} (${columns})
      SELECT ${columns} FROM ${sql.id(STAGING)} ORDER BY line_number`.execute(trx);
    const acceptedRows = Number(merged.numAffectedRows ?? 0n);
    await def.afterMerge?.(trx);

    // Step 7: record the batch and its rejects.
    const rejectList = [...rejects.values()].sort((a, b) => a.line - b.line);
    const batch = await trx
      .insertInto('import_batches')
      .values({
        dataset: def.name,
        file_name: input.fileName,
        file_sha256: fileSha256,
        total_rows: rows.length,
        accepted_rows: acceptedRows,
        rejected_rows: rejectList.length,
        uploaded_by: input.uploadedBy ?? null,
        started_at: startedAt,
      })
      .returning('batch_id')
      .executeTakeFirstOrThrow();

    if (rejectList.length) {
      await trx
        .insertInto('import_rejects')
        .values(
          rejectList.map((r) => ({
            batch_id: batch.batch_id,
            line_number: r.line,
            record_key: r.recordKey,
            reason_code: r.reasons[0]!.code,
            reasons: JSON.stringify(r.reasons),
            raw_row: JSON.stringify(r.raw),
          })),
        )
        .execute();
    }

    return {
      status: 'IMPORTED',
      batchId: batch.batch_id,
      dataset: def.name,
      fileName: input.fileName,
      totalRows: rows.length,
      acceptedRows,
      rejectedRows: rejectList.length,
      rejects: rejectList,
    } satisfies ImportResult;
  });
}

function keyOf(
  def: DatasetDefinition,
  values: Record<string, string | null | undefined>,
): string | null {
  const parts = def.key.map((k) => values[k]);
  return parts.every(Boolean) ? parts.join('/') : null;
}

/**
 * Same key more than once in one file:
 *  - identical copies → keep the first, reject the rest as DUPLICATE_ROW
 *  - copies that differ → reject all of them as CONFLICTING_DUPLICATE,
 *    because there is no safe way to choose which one is right.
 */
function removeInFileDuplicates(
  def: DatasetDefinition,
  rows: ValidRow[],
  reject: (line: number, reason: RejectReason) => void,
): ValidRow[] {
  const groups = new Map<string, ValidRow[]>();
  for (const row of rows) {
    const key = keyOf(def, row.data)!;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const kept: ValidRow[] = [];
  for (const [key, group] of groups) {
    const [first, ...others] = group as [ValidRow, ...ValidRow[]];
    if (others.length === 0) {
      kept.push(first);
      continue;
    }
    const signature = (r: ValidRow) => JSON.stringify(def.columns.map((c) => r.data[c]));
    if (others.every((r) => signature(r) === signature(first))) {
      kept.push(first);
      for (const r of others) {
        reject(r.line, {
          code: REASON.DUPLICATE_ROW,
          field: def.key[0],
          message: `${key} is an exact copy of line ${first.line}`,
        });
      }
    } else {
      for (const r of group) {
        reject(r.line, {
          code: REASON.CONFLICTING_DUPLICATE,
          field: def.key[0],
          message: `${key} appears on lines ${group.map((g) => g.line).join(', ')} with different values`,
        });
      }
    }
  }
  return kept;
}

async function insertStaging(trx: Transaction<DB>, def: DatasetDefinition, rows: ValidRow[]) {
  if (rows.length === 0) return;
  const columns = sql.join([...def.columns, 'line_number'].map((c) => sql.ref(c)));
  const values = sql.join(
    rows.map((r) => sql`(${sql.join([...def.columns.map((c) => r.data[c] ?? null), r.line])})`),
  );
  await sql`INSERT INTO ${sql.id(STAGING)} (${columns}) VALUES ${values}`.execute(trx);
}

function toReason(issue: z.core.$ZodIssue): RejectReason {
  const field = issue.path.length ? String(issue.path[0]) : undefined;
  const custom =
    issue.code === 'custom' ? (issue.params?.reason as ReasonCode | undefined) : undefined;
  const code: ReasonCode =
    custom ??
    (issue.code === 'invalid_value'
      ? REASON.INVALID_ENUM
      : issue.code === 'invalid_type' ||
          (issue.code === 'too_small' && issue.origin === 'string' && issue.minimum === 1)
        ? REASON.REQUIRED
        : issue.code === 'too_small' || issue.code === 'too_big'
          ? REASON.OUT_OF_RANGE
          : REASON.INVALID_FORMAT);
  return { code, ...(field && { field }), message: issue.message };
}
