import type { ImportBatch, RejectedRow } from '@finpilot/shared';
import type { Db } from '../../db/index.js';

export async function listBatches(db: Db, q: { page: number; pageSize: number; dataset?: string }) {
  let base = db.selectFrom('import_batches as b');
  if (q.dataset) base = base.where('b.dataset', '=', q.dataset);

  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
    base
      .leftJoin('users as u', 'u.user_id', 'b.uploaded_by')
      .select([
        'b.batch_id',
        'b.dataset',
        'b.file_name',
        'b.file_sha256',
        'b.total_rows',
        'b.accepted_rows',
        'b.rejected_rows',
        'b.started_at',
        'b.finished_at',
        'u.full_name as uploaded_by',
      ])
      .orderBy('b.batch_id', 'desc')
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
      .execute(),
  ]);

  const data = rows.map((b): ImportBatch => ({
    batchId: b.batch_id,
    dataset: b.dataset as ImportBatch['dataset'],
    fileName: b.file_name,
    fileSha256: b.file_sha256,
    totalRows: b.total_rows,
    acceptedRows: b.accepted_rows,
    rejectedRows: b.rejected_rows,
    uploadedBy: b.uploaded_by,
    startedAt: b.started_at.toISOString(),
    finishedAt: b.finished_at.toISOString(),
  }));
  return { data, totalItems: Number(total) };
}

export async function batchExists(db: Db, batchId: string): Promise<boolean> {
  const row = await db
    .selectFrom('import_batches')
    .select('batch_id')
    .where('batch_id', '=', batchId)
    .executeTakeFirst();
  return row !== undefined;
}

export async function listRejects(db: Db, batchId: string, q: { page: number; pageSize: number }) {
  const base = db.selectFrom('import_rejects').where('batch_id', '=', batchId);
  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
    base
      .select(['line_number', 'record_key', 'reasons', 'raw_row'])
      .orderBy('line_number')
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
      .execute(),
  ]);
  const data = rows.map((r): RejectedRow => ({
    line: r.line_number,
    recordKey: r.record_key,
    reasons: r.reasons as RejectedRow['reasons'],
    raw: r.raw_row as RejectedRow['raw'],
  }));
  return { data, totalItems: Number(total) };
}
