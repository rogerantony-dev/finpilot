import { errorResponse, loginRequest, sessionUser } from '@finpilot/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { verifyCredentials } from './auth.service.js';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Sign in',
        description:
          'Verifies email and password and sets an httpOnly session cookie (`finpilot_session`). ' +
          'Rate limited to 10 attempts per minute per IP.',
        body: loginRequest,
        response: { 200: z.object({ user: sessionUser }), 401: errorResponse, 429: errorResponse },
      },
    },
    async (req, reply) => {
      const user = await verifyCredentials(app.db, req.body.email, req.body.password);
      if (!user) {
        req.log.warn({ email: req.body.email }, 'login failed');
        throw new AppError(401, 'UNAUTHENTICATED', 'Invalid email or password');
      }
      await app.startSession(reply, user);
      req.log.info({ userId: user.id, role: user.role }, 'login succeeded');
      return { user };
    },
  );

  app.post(
    '/auth/logout',
    { schema: { tags: ['auth'], summary: 'Sign out', response: { 204: z.null() } } },
    async (_req, reply) => {
      app.endSession(reply);
      return reply.code(204).send(null);
    },
  );

  app.get(
    '/auth/me',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Current user',
        response: { 200: z.object({ user: sessionUser }), 401: errorResponse },
      },
    },
    async (req) => ({ user: req.user }),
  );
};
