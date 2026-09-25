import cors from '@fastify/cors';
import { errorResponse } from '@finpilot/shared';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import type { Db } from './db/index.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { customerRoutes } from './modules/customers/customers.routes.js';
import { goalRoutes } from './modules/goals/goals.routes.js';
import { portfolioRoutes } from './modules/portfolio/portfolio.routes.js';
import { importRoutes } from './modules/imports/imports.routes.js';
import { healthRoutes } from './modules/system/health.routes.js';
import { transactionRoutes } from './modules/transactions/transactions.routes.js';
import { authPlugin } from './plugins/auth.js';
import { errorHandler } from './plugins/errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Config;
  }
}

export async function buildApp(config: Config, db: Db, opts: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      ...(config.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
    },
    // Request correlation: honour an incoming X-Request-Id, otherwise generate one.
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024,
    ...opts,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('db', db);
  app.decorate('config', config);

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
    // Customer data must not be stored by browsers or intermediaries.
    if (req.url.startsWith('/api/v1')) reply.header('cache-control', 'no-store');
  });

  await app.register(errorHandler);
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  // Only routes that opt in (login) are rate limited.
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'FinPilot API',
        description:
          'Investment portfolio and goal monitoring API (synthetic data only).\n\n' +
          'Authenticate with `POST /api/v1/auth/login`; the session cookie is then sent ' +
          'automatically (including from this page). Errors share one shape: ' +
          '`{ error: { code, message, details?, requestId } }`.',
        version: '1.0.0',
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          sessionCookie: { type: 'apiKey', in: 'cookie', name: 'finpilot_session' },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  await app.register(
    async (v1) => {
      // Public
      await v1.register(healthRoutes);
      await v1.register(authRoutes);

      // Everything else requires a signed-in user.
      await v1.register(async (secured) => {
        secured.addHook('onRequest', secured.authenticate);
        // Document the cookie requirement and the 401 on every secured route.
        secured.addHook('onRoute', (route) => {
          route.schema = {
            ...route.schema,
            security: [{ sessionCookie: [] }],
            response: { ...(route.schema?.response as object), 401: errorResponse },
          };
        });
        await secured.register(customerRoutes);
        await secured.register(portfolioRoutes);
        await secured.register(transactionRoutes);
        await secured.register(goalRoutes);
        await secured.register(importRoutes);
      });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
