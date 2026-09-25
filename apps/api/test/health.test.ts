import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createDb } from '../src/db/index.js';

// An unreachable database: /health must report "degraded" with 503, not crash.
const config: Config = {
  NODE_ENV: 'test',
  API_PORT: 0,
  LOG_LEVEL: 'fatal',
  DATABASE_URL: 'postgres://nobody:nothing@127.0.0.1:1/none',
  JWT_SECRET: 'x'.repeat(32),
  WEB_ORIGIN: 'http://localhost:5173',
  COOKIE_SECURE: false,
  TRUST_PROXY: false,
};

describe('GET /api/v1/health', () => {
  const db = createDb(config.DATABASE_URL);
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp(config, db);
  });
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('returns 503 and database=down when the database is unreachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', checks: { database: 'down' } });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('does not leak configuration', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.body).not.toContain(config.JWT_SECRET);
    expect(res.body).not.toContain('postgres://');
  });
});
