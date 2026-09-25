import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, seedTestDb } from '../helpers/app.js';
import { createTestDb } from '../helpers/db.js';

const db = createTestDb();
let app: Awaited<ReturnType<typeof createTestApp>>;
let cookie: string;
const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
const sum = (values: string[]) =>
  values.reduce((acc, v) => acc + Math.round(Number(v) * 100), 0) / 100;

beforeAll(async () => {
  await seedTestDb(db);
  app = await createTestApp(db);
  cookie = await login(app, 'viewer');
});
afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe('GET /api/v1/customers/:customerId/portfolio', () => {
  it('values the portfolio from the snapshot and latest prices', async () => {
    const res = await get('/api/v1/customers/C0026/portfolio');
    expect(res.statusCode).toBe(200);
    const p = res.json();
    // Cross-checked against an independent calculation from the raw CSVs.
    expect(p.totals.marketValue).toBe('1953574.62');
    expect(p).toMatchObject({
      currency: 'INR',
      snapshotDate: '2026-09-18',
      priceAsOf: '2026-09-18',
    });
    expect(p.accounts).toHaveLength(3);
  });

  it('keeps account totals, allocation and positions consistent with the customer total', async () => {
    const p = (await get('/api/v1/customers/C0026/portfolio')).json();
    const total = Number(p.totals.marketValue);
    expect(sum(p.accounts.map((a: { marketValue: string }) => a.marketValue))).toBeCloseTo(
      total,
      2,
    );
    expect(sum(p.positions.map((x: { marketValue: string }) => x.marketValue))).toBeCloseTo(
      total,
      2,
    );
    expect(sum(p.allocation.map((s: { marketValue: string }) => s.marketValue))).toBeCloseTo(
      total,
      2,
    );
    expect(sum(p.allocation.map((s: { weightPct: string }) => s.weightPct))).toBeCloseTo(100, 0);
    expect(p.totals.positionCount).toBe(p.positions.length);
    // Rounded amounts add up exactly: cost basis + P/L = market value.
    expect(sum([p.totals.costBasis, p.totals.unrealisedPnl])).toBe(total);
  });

  it('computes unrealised P/L per position as quantity × (price − avg cost)', async () => {
    const p = (await get('/api/v1/customers/C0026/portfolio')).json();
    for (const pos of p.positions) {
      const expected = Number(pos.quantity) * (Number(pos.lastPrice) - Number(pos.avgCost));
      expect(Number(pos.unrealisedPnl)).toBeCloseTo(expected, 1);
      expect(sum([pos.costBasis, pos.unrealisedPnl])).toBe(Number(pos.marketValue));
    }
  });

  it('includes accounts with no holdings at zero value', async () => {
    const p = (await get('/api/v1/customers/C0001/portfolio')).json();
    const closed = p.accounts.find((a: { accountId: string }) => a.accountId === 'A00001');
    expect(closed).toMatchObject({ status: 'CLOSED', positionCount: 0, marketValue: '0' });
  });

  it('returns 404 for an unknown customer', async () => {
    expect((await get('/api/v1/customers/C9999/portfolio')).statusCode).toBe(404);
  });
});
