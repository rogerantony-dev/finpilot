import type { ErrorResponse } from '@finpilot/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors.js';

/**
 * One error shape for every failure:
 *   { error: { code, message, details?, requestId } }
 * Expected errors (AppError, validation) are returned as-is; anything else is
 * logged with its stack and returned as a generic 500, so internals never leak.
 */
export const errorHandler = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const send = (status: number, error: Omit<ErrorResponse['error'], 'requestId'>) =>
      reply.code(status).send({ error: { ...error, requestId: req.id } } satisfies ErrorResponse);

    if (hasZodFastifySchemaValidationErrors(err)) {
      return send(400, {
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid',
        details: err.validation.map((v) => ({
          field: v.instancePath.replace(/^\//, '').replace(/\//g, '.') || undefined,
          message: v.message ?? 'Invalid value',
        })),
      });
    }

    if (err instanceof AppError) {
      if (err.statusCode >= 500) req.log.error({ err }, err.message);
      return send(err.statusCode, {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      });
    }

    if (err.statusCode === 429) {
      return send(429, { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' });
    }

    // Malformed JSON, oversized body, wrong content type, etc.
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return send(err.statusCode, { code: 'VALIDATION_ERROR', message: err.message });
    }

    if (isResponseSerializationError(err)) {
      req.log.error({ err, issues: err.cause.issues }, 'response did not match its schema');
    } else {
      req.log.error({ err }, 'unhandled error');
    }
    return send(500, { code: 'INTERNAL_ERROR', message: 'Something went wrong' });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.url} not found`,
        requestId: req.id,
      },
    } satisfies ErrorResponse);
  });
});
