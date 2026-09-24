import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, seedTestDb } from '../helpers/app.js';
import { createTestDb } from '../helpers/db.js';

const db = createTestDb();
let app: Awaited<ReturnType<typeof createTestApp>>;
let cookie: string;

const request = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, ...(payload && { payload }) });

const validGoal = {
  goalType: 'HOME_PURCHASE',
  goalName: 'Flat in Kochi',
  targetAmount: '5000000',
  currentFundedAmount: '500000.50',
  targetDate: '2031-03-31',
  priority: 'HIGH',
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

describe('GET /api/v1/customers/:customerId/goals', () => {
  it('returns goals with funded percentage', async () => {
    const res = await request('GET', '/api/v1/customers/C0001/goals');
    expect(res.statusCode).toBe(200);
    const g = res.json().data.find((x: { goalId: string }) => x.goalId === 'G00001');
    // 5000753.18 / 6076934.41 = 82.29%
    expect(g).toMatchObject({ fundedPct: '82.29', flags: { overdue: false, overfunded: false } });
  });
});

describe('POST /api/v1/customers/:customerId/goals', () => {
  it('creates a goal with the next ID and computed fields', async () => {
    const res = await request('POST', '/api/v1/customers/C0001/goals', validGoal);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      goalId: 'G00178',
      customerId: 'C0001',
      goalName: 'Flat in Kochi',
      targetAmount: '5000000.00',
      fundedPct: '10.00',
      flags: { highPriorityUnderfunded: true },
    });
  });

  it('returns field errors for invalid input', async () => {
    const res = await request('POST', '/api/v1/customers/C0001/goals', {
      ...validGoal,
      goalName: '   ',
      targetAmount: '0',
      currentFundedAmount: '-5',
      priority: 'URGENT',
    });
    expect(res.statusCode).toBe(400);
    const fields = res.json().error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['goalName', 'targetAmount', 'currentFundedAmount', 'priority']),
    );
  });

  it('rejects a target date in the past with 422', async () => {
    const res = await request('POST', '/api/v1/customers/C0001/goals', {
      ...validGoal,
      targetDate: '2020-01-01',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details[0].field).toBe('targetDate');
  });

  it('returns 404 for an unknown customer', async () => {
    expect((await request('POST', '/api/v1/customers/C9999/goals', validGoal)).statusCode).toBe(
      404,
    );
  });
});

describe('PATCH /api/v1/goals/:goalId', () => {
  it('updates only the fields sent and flags over-funding', async () => {
    const res = await request('PATCH', '/api/v1/goals/G00001', { currentFundedAmount: '7000000' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      goalName: 'Family Education',
      currentFundedAmount: '7000000.00',
      flags: { overfunded: true },
    });
  });

  it('keeps an existing past date but refuses to set a new one', async () => {
    await db
      .updateTable('goals')
      .set({ target_date: '2025-01-01' })
      .where('goal_id', '=', 'G00002')
      .execute();
    const unchangedDate = await request('PATCH', '/api/v1/goals/G00002', { priority: 'HIGH' });
    expect(unchangedDate.statusCode).toBe(200);
    expect(unchangedDate.json().flags.overdue).toBe(true);

    const newPastDate = await request('PATCH', '/api/v1/goals/G00002', {
      targetDate: '2024-01-01',
    });
    expect(newPastDate.statusCode).toBe(422);
  });

  it('rejects an empty update and unknown goals', async () => {
    expect((await request('PATCH', '/api/v1/goals/G00001', {})).statusCode).toBe(400);
    expect((await request('PATCH', '/api/v1/goals/G99999', { priority: 'LOW' })).statusCode).toBe(
      404,
    );
  });
});
