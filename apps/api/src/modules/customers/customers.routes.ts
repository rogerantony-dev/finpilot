import {
  cityList,
  customerDetail,
  customerIdParam,
  customerList,
  customerListQuery,
  errorResponse,
} from '@finpilot/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { notFound } from '../../lib/errors.js';
import { pageInfo } from '../../lib/sql.js';
import { getCustomer, listCities, listCustomers } from './customers.repository.js';

export const customerRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/customers',
    {
      schema: {
        tags: ['customers'],
        summary: 'Search customers',
        description:
          '`q` matches customer ID (prefix), name, email or city (case-insensitive). ' +
          'Filters combine with AND. Paginated server-side.',
        querystring: customerListQuery,
        response: { 200: customerList, 400: errorResponse },
      },
    },
    async (req) => {
      const { rows, totalItems } = await listCustomers(app.db, req.query);
      return { data: rows, page: pageInfo(req.query.page, req.query.pageSize, totalItems) };
    },
  );

  app.get(
    '/customers/cities',
    {
      schema: {
        tags: ['customers'],
        summary: 'Distinct customer cities (for filters)',
        response: { 200: cityList },
      },
    },
    async () => ({ data: await listCities(app.db) }),
  );

  app.get(
    '/customers/:customerId',
    {
      schema: {
        tags: ['customers'],
        summary: 'Customer profile with latest risk profile',
        description: '`riskProfile` is null when the customer has no assessment on file.',
        params: customerIdParam,
        response: { 200: customerDetail, 404: errorResponse },
      },
    },
    async (req) => {
      const customer = await getCustomer(app.db, req.params.customerId);
      if (!customer) throw notFound(`Customer ${req.params.customerId}`);
      return customer;
    },
  );
};
