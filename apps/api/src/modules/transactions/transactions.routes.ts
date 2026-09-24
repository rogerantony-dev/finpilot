import {
  customerIdParam,
  errorResponse,
  instrumentList,
  transactionList,
  transactionListQuery,
} from '@finpilot/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { notFound } from '../../lib/errors.js';
import { pageInfo } from '../../lib/sql.js';
import { customerExists } from '../customers/customers.repository.js';
import { listInstruments, listTransactions } from './transactions.repository.js';

export const transactionRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/customers/:customerId/transactions',
    {
      schema: {
        tags: ['transactions'],
        summary: "List a customer's transactions",
        description:
          'Server-side filtering (date range, account, instrument, type, status), sorting and ' +
          'pagination. Default order: newest trade first. PENDING and REVERSED rows are returned ' +
          'with their `status` so clients can display them distinctly.',
        params: customerIdParam,
        querystring: transactionListQuery,
        response: { 200: transactionList, 400: errorResponse, 404: errorResponse },
      },
    },
    async (req) => {
      if (!(await customerExists(app.db, req.params.customerId))) {
        throw notFound(`Customer ${req.params.customerId}`);
      }
      const { data, totalItems } = await listTransactions(app.db, req.params.customerId, req.query);
      return { data, page: pageInfo(req.query.page, req.query.pageSize, totalItems) };
    },
  );

  app.get(
    '/instruments',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Instrument list (for filters)',
        response: { 200: instrumentList },
      },
    },
    async () => ({ data: await listInstruments(app.db) }),
  );
};
