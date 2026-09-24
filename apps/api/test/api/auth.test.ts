import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, seedTestDb, USERS, cookieHeader } from '../helpers/app.js';
import { createTestDb } from '../helpers/db.js';

const db = createTestDb();
let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  await seedTestDb(db);
  app = await createTestApp(db);
});
afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe('POST /api/v1/auth/login', () => {
  it('sets an httpOnly, SameSite=Strict session cookie and returns the user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: USERS.admin,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: USERS.admin.email, role: 'ADMIN' });
    expect(res.json().user).not.toHaveProperty('password_hash');
    const cookie = res.cookies.find((c) => c.name === 'finpilot_session')!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api' });
  });

  it('accepts the email case-insensitively', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { ...USERS.viewer, email: USERS.viewer.email.toUpperCase() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: USERS.viewer.email, password: 'nope' },
    });
    const unknownUser = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nobody@finpilot.test', password: 'nope' },
    });
    for (const res of [wrongPassword, unknownUser]) {
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toMatchObject({
        code: 'UNAUTHENTICATED',
        message: 'Invalid email or password',
      });
      expect(res.cookies).toHaveLength(0);
    }
  });

  it('returns field-level validation errors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
    const { error } = res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
    expect(error.requestId).toBe(res.headers['x-request-id']);
  });
});

describe('session', () => {
  it('rejects protected routes without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/customers' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a tampered token', async () => {
    const cookie = await login(app, 'viewer');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: cookie.slice(0, -3) + 'abc' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns the current user from /auth/me', async () => {
    const cookie = await login(app, 'viewer');
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: USERS.viewer.email, role: 'VIEWER' });
  });

  it('clears the cookie on logout', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
    expect(res.statusCode).toBe(204);
    expect(cookieHeader(res)).toBe('finpilot_session=');
  });
});

describe('errors', () => {
  it('returns the standard error shape for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });
  });
});
