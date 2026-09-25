import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, seedTestDb } from '../helpers/app.js';
import { createTestDb } from '../helpers/db.js';
import { rawFile, sampleFile } from '../helpers/files.js';

const db = createTestDb();
let app: Awaited<ReturnType<typeof createTestApp>>;
let admin: string;
let viewer: string;

const upload = (content: string, fileName: string, cookie = admin, contentType = 'text/csv') =>
  app.inject({
    method: 'POST',
    url: `/api/v1/admin/imports/transactions?fileName=${encodeURIComponent(fileName)}`,
    headers: { cookie, 'content-type': contentType },
    payload: content,
  });

beforeAll(async () => {
  await seedTestDb(db);
  app = await createTestApp(db);
  admin = await login(app, 'admin');
  viewer = await login(app, 'viewer');
});
afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe('POST /api/v1/admin/imports/transactions', () => {
  it('is forbidden for VIEWER and requires a session', async () => {
    expect(
      (await upload(sampleFile('transactions_2026-09-19.csv'), 'x.csv', viewer)).statusCode,
    ).toBe(403);
    expect((await upload(sampleFile('transactions_2026-09-19.csv'), 'x.csv', '')).statusCode).toBe(
      401,
    );
  });

  it('imports a clean daily file (201)', async () => {
    const res = await upload(
      sampleFile('transactions_2026-09-19.csv'),
      'transactions_2026-09-19.csv',
    );
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      status: 'IMPORTED',
      totalRows: 20,
      acceptedRows: 20,
      rejectedRows: 0,
    });
  });

  it('accepts valid rows and explains every rejected row', async () => {
    const res = await upload(
      sampleFile('transactions_with_errors.csv'),
      'transactions_with_errors.csv',
    );
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      totalRows: 17,
      acceptedRows: 4,
      rejectedRows: 13,
      rejectsTruncated: false,
    });
    expect(
      body.rejects.map((r: { line: number; reasons: { code: string }[] }) => [
        r.line,
        r.reasons[0]!.code,
      ]),
    ).toEqual([
      [5, 'UNKNOWN_REFERENCE'],
      [6, 'UNKNOWN_REFERENCE'],
      [7, 'INVALID_ENUM'],
      [8, 'INVALID_FORMAT'],
      [9, 'INCONSISTENT_ROW'],
      [10, 'NEGATIVE_AMOUNT'],
      [11, 'FUTURE_DATE'],
      [12, 'ALREADY_EXISTS'],
      [13, 'CONFLICTING_DUPLICATE'],
      [14, 'CONFLICTING_DUPLICATE'],
      [15, 'DUPLICATE_ROW'],
      [16, 'REQUIRED'],
      [18, 'INCONSISTENT_ROW'],
    ]);
    // The existing transaction was not overwritten.
    const t = await db
      .selectFrom('transactions')
      .select('amount')
      .where('transaction_id', '=', 'T0000001')
      .executeTakeFirstOrThrow();
    expect(t.amount).toBe('6191.15');
  });

  it('returns 200 ALREADY_IMPORTED for a file seen before, changing nothing', async () => {
    const before = await db
      .selectFrom('transactions')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const res = await upload(rawFile('transactions.csv'), 'transactions-again.csv');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ALREADY_IMPORTED',
      acceptedRows: 4550,
      rejectedRows: 4,
    });
    const after = await db
      .selectFrom('transactions')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    expect(after.n).toBe(before.n);
  });

  it('rejects a file with the wrong columns as a whole (422)', async () => {
    const res = await upload('id,amount\r\n1,2\r\n', 'wrong.csv');
    expect(res.statusCode).toBe(422);
    expect(res.json().error.message).toMatch(/Unexpected header/);
  });

  it('rejects an empty body and a non-CSV content type', async () => {
    expect((await upload('', 'empty.csv')).statusCode).toBe(400);
    expect((await upload('{}', 'x.json', admin, 'application/json')).statusCode).toBe(400);
  });
});

describe('import history and rejects', () => {
  it('lists batches newest first with the uploader', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/imports?pageSize=5',
      headers: { cookie: admin },
    });
    expect(res.statusCode).toBe(200);
    const [latest] = res.json().data;
    expect(latest).toMatchObject({
      fileName: 'transactions_with_errors.csv',
      uploadedBy: 'Test Admin',
      rejectedRows: 13,
    });
  });

  it('pages through the rejected rows of a batch', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/imports?pageSize=1',
      headers: { cookie: admin },
    });
    const batchId = list.json().data[0].batchId;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/imports/${batchId}/rejects?pageSize=5&page=3`,
      headers: { cookie: admin },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().page).toMatchObject({ page: 3, totalItems: 13, totalPages: 3 });
    expect(res.json().data).toHaveLength(3);
    expect(res.json().data[0].raw).toHaveProperty('transaction_id');
  });

  it('is admin-only and 404s for unknown batches', async () => {
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/admin/imports',
          headers: { cookie: viewer },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/admin/imports/99999/rejects',
          headers: { cookie: admin },
        })
      ).statusCode,
    ).toBe(404);
  });
});
