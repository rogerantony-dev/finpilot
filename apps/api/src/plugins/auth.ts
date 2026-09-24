import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { Role, SessionUser } from '@finpilot/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '../lib/errors.js';

export const SESSION_COOKIE = 'finpilot_session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // one working day

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: SessionUser;
    user: SessionUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** onRequest hook: 401 unless the request carries a valid session cookie. */
    authenticate: (req: FastifyRequest) => Promise<void>;
    /** preHandler: 403 unless the signed-in user has the role. */
    requireRole: (role: Role) => (req: FastifyRequest) => Promise<void>;
    startSession: (reply: FastifyReply, user: SessionUser) => Promise<void>;
    endSession: (reply: FastifyReply) => void;
  }
}

/**
 * Sessions are a signed JWT (HS256) in an httpOnly cookie:
 *  - httpOnly: page JavaScript cannot read it, so XSS cannot steal it
 *  - SameSite=Strict: the browser never sends it on cross-site requests (CSRF)
 *  - Secure when COOKIE_SECURE=true (behind TLS)
 *  - scoped to /api and expires after SESSION_TTL_SECONDS
 * The role travels in the token, so role checks need no database round trip.
 */
export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: app.config.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: SESSION_TTL_SECONDS },
  });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue');
    }
  });

  app.decorate('requireRole', (role: Role) => async (req: FastifyRequest) => {
    if (req.user.role !== role) {
      req.log.warn({ userId: req.user.id, role: req.user.role, required: role }, 'forbidden');
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do this');
    }
  });

  app.decorate('startSession', async (reply: FastifyReply, user: SessionUser) => {
    const token = await reply.jwtSign(user);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: app.config.COOKIE_SECURE,
      path: '/api',
      maxAge: SESSION_TTL_SECONDS,
    });
  });

  app.decorate('endSession', (reply: FastifyReply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/api' });
  });
});
