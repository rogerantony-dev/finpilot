import type { LightMyRequestResponse } from 'fastify';
import { buildApp } from '../../src/app.js';
import type { Config } from '../../src/config.js';
import type { Db } from '../../src/db/index.js';
import { LOAD_ORDER, type DatasetName } from '../../src/imports/datasets.js';
import { importCsv } from '../../src/imports/import-service.js';
import { seedUsers } from '../../src/seed/users.js';
import { resetDb } from './db.js';
import { rawFile } from './files.js';

export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  NODE_ENV: 'test',
  API_PORT: 0,
  LOG_LEVEL: 'fatal',
  DATABASE_URL: process.env.TEST_DATABASE_URL!,
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  WEB_ORIGIN: 'http://localhost:5173',
  COOKIE_SECURE: false,
  TRUST_PROXY: false,
  ...overrides,
});

export const USERS = {
  viewer: { email: 'viewer@finpilot.test', password: 'viewer-password' },
  admin: { email: 'admin@finpilot.test', password: 'admin-password' },
};

const FILES: Record<DatasetName, string> = {
  customers: 'customers.csv',
  risk_profiles: 'risk_profiles.csv',
  accounts: 'accounts.csv',
  instruments: 'instruments.csv',
  holdings: 'holdings_snapshot.csv',
  transactions: 'transactions.csv',
  goals: 'goals.csv',
};

/** Empty the test database and load the full supplied dataset plus demo users. */
export async function seedTestDb(db: Db) {
  await resetDb(db);
  for (const dataset of LOAD_ORDER) {
    await importCsv(db, {
      dataset,
      fileName: FILES[dataset],
      content: rawFile(FILES[dataset]),
      asOf: '2026-09-25',
    });
  }
  await seedUsers(db, [
    { ...USERS.viewer, fullName: 'Test Viewer', role: 'VIEWER' },
    { ...USERS.admin, fullName: 'Test Admin', role: 'ADMIN' },
  ]);
}

export async function createTestApp(db: Db) {
  return buildApp(testConfig(), db);
}

/** Log in and return the Cookie header value for later requests. */
export async function login(
  app: Awaited<ReturnType<typeof createTestApp>>,
  who: keyof typeof USERS,
) {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: USERS[who] });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  return cookieHeader(res);
}

export function cookieHeader(res: LightMyRequestResponse): string {
  return res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}
