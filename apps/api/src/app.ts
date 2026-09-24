import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { healthRoutes } from './routes/health.js';

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
    ...opts,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('db', db);
  app.decorate('config', config);

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(cookie);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'FinPilot API',
        description: 'Investment portfolio and goal monitoring API (synthetic data only).',
        version: '1.0.0',
      },
      servers: [{ url: '/' }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  await app.register(
    async (v1) => {
      await v1.register(healthRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
