import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, seedTestDb } from '../helpers/app.js';
import { createTestDb } from '../helpers/db.js';

const db = createTestDb();
let app: Awaited<ReturnType<typeof createTestApp>>;
let cookie: string;
const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });

beforeAll(async () => {
  await seedTestDb(db);
  app = await createTestApp(db);
  cookie = await login(app, 'viewer');
});
afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe('GET /api/v1/customers', () => {
  it('paginates on the server', async () => {
    const res = await get('/api/v1/customers?page=2&pageSize=50');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.page).toEqual({ page: 2, pageSize: 50, totalItems: 120, totalPages: 3 });
    expect(body.data).toHaveLength(50);
    expect(body.data[0].customerId).toBe('C0051');
  });

  it('searches name, email, city and ID prefix case-insensitively', async () => {
    const byName = (await get('/api/v1/customers?q=rohan&pageSize=100')).json();
    expect(byName.data.length).toBeGreaterThan(0);
    expect(byName.data.every((c: { fullName: string }) => /rohan/i.test(c.fullName))).toBe(true);

    const byId = (await get('/api/v1/customers?q=C0001')).json();
    expect(byId.data.map((c: { customerId: string }) => c.customerId)).toContain('C0001');

    const byCity = (await get('/api/v1/customers?q=KOCHI&pageSize=100')).json();
    expect(byCity.page.totalItems).toBe(16);
  });

  it('treats LIKE wildcards in the search literally', async () => {
    const res = (await get('/api/v1/customers?q=%25')).json();
    expect(res.page.totalItems).toBe(0);
  });

  it('combines filters', async () => {
    const res = (await get('/api/v1/customers?kycStatus=REVIEW&pageSize=100')).json();
    expect(res.page.totalItems).toBe(6);
    expect(res.data.every((c: { kycStatus: string }) => c.kycStatus === 'REVIEW')).toBe(true);
  });

  it('rejects invalid query parameters', async () => {
    const res = await get('/api/v1/customers?pageSize=1000&kycStatus=MAYBE');
    expect(res.statusCode).toBe(400);
    const fields = res.json().error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['pageSize', 'kycStatus']));
  });
});

describe('GET /api/v1/customers/:customerId', () => {
  it('returns the profile with the latest risk profile', async () => {
    const res = await get('/api/v1/customers/C0001');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      customerId: 'C0001',
      fullName: 'Rohan Sharma',
      kycStatus: 'VERIFIED',
      riskProfile: { riskScore: 81, riskLevel: 'Aggressive', assessedAt: '2026-07-21' },
    });
  });

  it('returns riskProfile null when none is on file', async () => {
    await db.deleteFrom('risk_profiles').where('customer_id', '=', 'C0002').execute();
    const res = await get('/api/v1/customers/C0002');
    expect(res.json().riskProfile).toBeNull();
  });

  it('returns 404 for an unknown customer and 400 for a malformed ID', async () => {
    expect((await get('/api/v1/customers/C9999')).statusCode).toBe(404);
    expect((await get('/api/v1/customers/bad-id')).statusCode).toBe(400);
  });
});
