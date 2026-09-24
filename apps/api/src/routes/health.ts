import { healthResponseSchema } from '@finpilot/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createRequire } from 'node:module';
import { pingDb } from '../db/index.js';

// Works from both src/ (dev) and dist/ (build): package.json is two levels up.
const { version } = createRequire(import.meta.url)('../../package.json') as { version: string };

const startedAt = Date.now();

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness and readiness',
        description: 'Reports API status and database connectivity. Never exposes configuration.',
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      },
    },
    async (_req, reply) => {
      const dbUp = await pingDb(app.db);
      const body = {
        status: dbUp ? ('ok' as const) : ('degraded' as const),
        version,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        checks: { database: dbUp ? ('up' as const) : ('down' as const) },
      };
      return reply.code(dbUp ? 200 : 503).send(body);
    },
  );
};
