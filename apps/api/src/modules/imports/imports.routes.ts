import {
  batchIdParam,
  errorResponse,
  importBatchList,
  importBatchListQuery,
  importResultDocumented,
  importUploadQuery,
  MAX_REJECTS_IN_RESPONSE,
  pageQuery,
  rejectList,
} from '@finpilot/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notFound, unprocessable } from '../../lib/errors.js';
import { pageInfo } from '../../lib/sql.js';
import { ImportFileError } from '../../imports/csv.js';
import { importCsv } from '../../imports/import-service.js';
import { batchExists, listBatches, listRejects } from './imports.repository.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Administrator-only data import. Mounted inside the authenticated scope. */
export const importRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireRole('ADMIN'));

  // The request body is the CSV file itself (Content-Type: text/csv).
  app.addContentTypeParser(
    ['text/csv', 'application/csv'],
    { parseAs: 'string', bodyLimit: MAX_UPLOAD_BYTES },
    (_req, body, done) => done(null, body),
  );

  app.post(
    '/admin/imports/transactions',
    {
      schema: {
        tags: ['admin'],
        summary: 'Import a transactions CSV',
        description:
          'Send the file as the request body with `Content-Type: text/csv` (max 5 MB); same columns as ' +
          '`transactions.csv`. Every row is validated (format, enums, dates, amounts, known account and ' +
          'instrument, duplicates); valid rows are merged in one database transaction and rejected rows ' +
          'are recorded with reasons. Returns **201** for a new import, or **200** with ' +
          '`status: ALREADY_IMPORTED` if this exact file (by SHA-256) was imported before: nothing changes. ' +
          `At most ${MAX_REJECTS_IN_RESPONSE} rejected rows are returned inline; ` +
          'the full list is at `/admin/imports/{batchId}/rejects`. ' +
          'A file with a wrong header is rejected as a whole with 422. ADMIN role required.',
        consumes: ['text/csv'],
        querystring: importUploadQuery,
        body: z.string().min(1, { error: 'The file is empty' }),
        response: {
          200: importResultDocumented,
          201: importResultDocumented,
          400: errorResponse,
          403: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (req, reply) => {
      let result;
      try {
        result = await importCsv(app.db, {
          dataset: 'transactions',
          fileName: req.query.fileName,
          content: req.body,
          uploadedBy: req.user.id,
        });
      } catch (err) {
        if (err instanceof ImportFileError) {
          req.log.warn({ fileName: req.query.fileName, code: err.code }, 'import file rejected');
          throw unprocessable(err.message, [{ message: err.message }]);
        }
        throw err;
      }

      req.log.info(
        {
          batchId: result.batchId,
          dataset: result.dataset,
          fileName: result.fileName,
          status: result.status,
          totalRows: result.totalRows,
          acceptedRows: result.acceptedRows,
          rejectedRows: result.rejectedRows,
          userId: req.user.id,
        },
        'import completed',
      );

      return reply.code(result.status === 'IMPORTED' ? 201 : 200).send({
        ...result,
        rejects: result.rejects.slice(0, MAX_REJECTS_IN_RESPONSE),
        rejectsTruncated: result.rejects.length > MAX_REJECTS_IN_RESPONSE,
      });
    },
  );

  app.get(
    '/admin/imports',
    {
      schema: {
        tags: ['admin'],
        summary: 'Import history (newest first)',
        querystring: importBatchListQuery,
        response: { 200: importBatchList, 403: errorResponse },
      },
    },
    async (req) => {
      const { data, totalItems } = await listBatches(app.db, req.query);
      return { data, page: pageInfo(req.query.page, req.query.pageSize, totalItems) };
    },
  );

  app.get(
    '/admin/imports/:batchId/rejects',
    {
      schema: {
        tags: ['admin'],
        summary: 'Rejected rows of one import batch, with reasons and the original row',
        params: batchIdParam,
        querystring: pageQuery,
        response: { 200: rejectList, 403: errorResponse, 404: errorResponse },
      },
    },
    async (req) => {
      if (!(await batchExists(app.db, req.params.batchId)))
        throw notFound(`Import batch ${req.params.batchId}`);
      const { data, totalItems } = await listRejects(app.db, req.params.batchId, req.query);
      return { data, page: pageInfo(req.query.page, req.query.pageSize, totalItems) };
    },
  );
};
