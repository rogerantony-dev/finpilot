import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ImportFileError } from '../../src/imports/csv.js';
import { importCsv } from '../../src/imports/import-service.js';
import { createTestDb, resetDb } from '../helpers/db.js';
import { rawFile } from '../helpers/files.js';

const db = createTestDb();
const AS_OF = '2026-09-25';

async function loadReferenceData() {
  for (const [dataset, file] of [
    ['customers', 'customers.csv'],
    ['accounts', 'accounts.csv'],
    ['instruments', 'instruments.csv'],
  ] as const) {
    await importCsv(db, { dataset, fileName: file, content: rawFile(file), asOf: AS_OF });
  }
}

const TX_HEADER =
  'transaction_id,account_id,instrument_id,transaction_type,trade_date,quantity,price,amount,status';
const txFile = (...lines: string[]) => [TX_HEADER, ...lines].join('\r\n') + '\r\n';
const count = async (table: 'transactions' | 'import_batches') =>
  Number(
    (
      await db
        .selectFrom(table)
        .select((eb) => eb.fn.countAll().as('n'))
        .executeTakeFirstOrThrow()
    ).n,
  );

beforeEach(async () => {
  await resetDb(db);
  await loadReferenceData();
});
afterAll(() => db.destroy());

describe('importCsv: supplied transactions.csv', () => {
  it('accepts 4,550 rows and rejects the 4 planted anomalies with reasons', async () => {
    const result = await importCsv(db, {
      dataset: 'transactions',
      fileName: 'transactions.csv',
      content: rawFile('transactions.csv'),
      asOf: AS_OF,
    });

    expect(result).toMatchObject({
      status: 'IMPORTED',
      totalRows: 4554,
      acceptedRows: 4550,
      rejectedRows: 4,
    });
    expect(result.rejects.map((r) => [r.line, r.recordKey, r.reasons[0]!.code])).toEqual([
      [4552, 'T0000026', 'DUPLICATE_ROW'],
      [4553, 'T0004551', 'UNKNOWN_REFERENCE'],
      [4554, 'T0004552', 'NEGATIVE_AMOUNT'],
      [4555, 'T0004553', 'FUTURE_DATE'],
    ]);
    expect(await count('transactions')).toBe(4550);

    const stored = await db
      .selectFrom('import_rejects')
      .select(['line_number', 'reason_code'])
      .orderBy('line_number')
      .execute();
    expect(stored).toHaveLength(4);
  });

  it('is idempotent: importing the same file again changes nothing', async () => {
    const input = {
      dataset: 'transactions',
      fileName: 'transactions.csv',
      content: rawFile('transactions.csv'),
      asOf: AS_OF,
    } as const;
    const first = await importCsv(db, input);
    const second = await importCsv(db, { ...input, fileName: 'renamed-copy.csv' });

    expect(second).toMatchObject({
      status: 'ALREADY_IMPORTED',
      batchId: first.batchId,
      acceptedRows: 4550,
    });
    expect(await count('transactions')).toBe(4550);
    expect(await count('import_batches')).toBe(4); // 3 reference files + 1 transactions file
  });
});

describe('importCsv: validation rules', () => {
  it('rejects every copy of a key that appears with different values', async () => {
    const result = await importCsv(db, {
      dataset: 'transactions',
      fileName: 'conflict.csv',
      content: txFile(
        'T9000001,A00002,I0001,BUY,2026-01-02,1,100,100,SETTLED',
        'T9000001,A00002,I0001,BUY,2026-01-02,2,100,200,SETTLED',
        'T9000002,A00002,I0001,SELL,2026-01-03,1,100,100,SETTLED',
      ),
      asOf: AS_OF,
    });
    expect(result.acceptedRows).toBe(1);
    expect(result.rejects.map((r) => [r.line, r.reasons[0]!.code])).toEqual([
      [2, 'CONFLICTING_DUPLICATE'],
      [3, 'CONFLICTING_DUPLICATE'],
    ]);
  });

  it('never overwrites a transaction that already exists', async () => {
    await importCsv(db, {
      dataset: 'transactions',
      fileName: 'a.csv',
      content: txFile('T9000001,A00002,I0001,BUY,2026-01-02,1,100,100,SETTLED'),
      asOf: AS_OF,
    });
    const result = await importCsv(db, {
      dataset: 'transactions',
      fileName: 'b.csv',
      content: txFile('T9000001,A00002,I0001,BUY,2026-01-02,5,100,500,SETTLED'),
      asOf: AS_OF,
    });
    expect(result.rejects[0]!.reasons[0]!.code).toBe('ALREADY_EXISTS');
    const row = await db
      .selectFrom('transactions')
      .select('amount')
      .where('transaction_id', '=', 'T9000001')
      .executeTakeFirstOrThrow();
    expect(row.amount).toBe('100.00');
  });

  it('reports field-level reasons for invalid values', async () => {
    const result = await importCsv(db, {
      dataset: 'transactions',
      fileName: 'bad.csv',
      content: txFile(
        'T9000001,A99999,I0001,BUY,2026-01-02,1,100,100,SETTLED', // unknown account
        'T9000002,A00002,I0001,SWAP,2026-01-02,1,100,100,SETTLED', // bad enum
        'T9000003,A00002,I0001,BUY,2026-02-30,1,100,100,SETTLED', // not a real date
        'T9000004,A00002,I0001,DIVIDEND,2026-01-02,3,10,30,SETTLED', // cash event with units
        'T9000005,A00002,I0001,BUY,2026-01-02,2,100,999,SETTLED', // amount != qty × price
        'T9000006,A00002,I0001,FEE,2026-01-02,0,0,,SETTLED', // missing amount
      ),
      asOf: AS_OF,
    });
    expect(result.acceptedRows).toBe(0);
    expect(
      result.rejects.map((r) => [r.recordKey, r.reasons[0]!.code, r.reasons[0]!.field]),
    ).toEqual([
      ['T9000001', 'UNKNOWN_REFERENCE', 'account_id'],
      ['T9000002', 'INVALID_ENUM', 'transaction_type'],
      ['T9000003', 'INVALID_FORMAT', 'trade_date'],
      ['T9000004', 'INCONSISTENT_ROW', 'quantity'],
      ['T9000005', 'INCONSISTENT_ROW', 'amount'],
      ['T9000006', 'REQUIRED', 'amount'],
    ]);
  });

  it('rejects a file with the wrong header without writing anything', async () => {
    await expect(
      importCsv(db, {
        dataset: 'transactions',
        fileName: 'x.csv',
        content: 'id,amount\r\n1,2\r\n',
        asOf: AS_OF,
      }),
    ).rejects.toBeInstanceOf(ImportFileError);
    expect(await count('import_batches')).toBe(3);
  });
});

describe('importCsv: holdings snapshot', () => {
  it('de-duplicates the 3 exact duplicate positions', async () => {
    const result = await importCsv(db, {
      dataset: 'holdings',
      fileName: 'holdings_snapshot.csv',
      content: rawFile('holdings_snapshot.csv'),
      asOf: AS_OF,
    });
    expect(result).toMatchObject({ acceptedRows: 982, rejectedRows: 3 });
    expect(result.rejects.every((r) => r.reasons[0]!.code === 'DUPLICATE_ROW')).toBe(true);
  });
});
