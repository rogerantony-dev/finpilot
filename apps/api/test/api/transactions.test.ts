import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, seedTestDb } from '../helpers/app.js';
import { createTestDb } from '../helpers/db.js';

const db = createTestDb();
let app: Awaited<ReturnType<typeof createTestApp>>;
let cookie: string;
const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });

type Tx = {
  transactionId: string;
  accountId: string;
  tradeDate: string;
  transactionType: string;
  status: string;
};

beforeAll(async () => {
  await seedTestDb(db);
  app = await createTestApp(db);
  cookie = await login(app, 'viewer');
});
afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe('GET /api/v1/customers/:customerId/transactions', () => {
  it('returns newest first with server-side pagination', async () => {
    const res = await get('/api/v1/customers/C0026/transactions?pageSize=10');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(10);
    expect(body.page.totalItems).toBeGreaterThan(10);
    const dates = body.data.map((t: Tx) => t.tradeDate);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('pages without overlap', async () => {
    const p1 = (await get('/api/v1/customers/C0026/transactions?pageSize=5&page=1')).json().data;
    const p2 = (await get('/api/v1/customers/C0026/transactions?pageSize=5&page=2')).json().data;
    const ids = new Set([...p1, ...p2].map((t: Tx) => t.transactionId));
    expect(ids.size).toBe(10);
  });

  it('filters by date range, type and status', async () => {
    const body = (
      await get(
        '/api/v1/customers/C0026/transactions?from=2026-01-01&to=2026-06-30&type=BUY&status=SETTLED&pageSize=100',
      )
    ).json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const t of body.data as Tx[]) {
      expect(t.tradeDate >= '2026-01-01' && t.tradeDate <= '2026-06-30').toBe(true);
      expect(t).toMatchObject({ transactionType: 'BUY', status: 'SETTLED' });
    }
  });

  it("never returns another customer's account, even if asked for it", async () => {
    // A00002 belongs to C0002, not C0026.
    const body = (await get('/api/v1/customers/C0026/transactions?accountId=A00002')).json();
    expect(body.page.totalItems).toBe(0);
  });

  it('rejects an inverted date range', async () => {
    const res = await get('/api/v1/customers/C0026/transactions?from=2026-06-01&to=2026-01-01');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].field).toBe('from');
  });
});
