import { customerIdParam, errorResponse, portfolio } from '@finpilot/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { notFound } from '../../lib/errors.js';
import { customerExists } from '../customers/customers.repository.js';
import { getPortfolio } from './portfolio.repository.js';

export const portfolioRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/customers/:customerId/portfolio',
    {
      schema: {
        tags: ['portfolio'],
        summary: 'Portfolio: totals, accounts, asset allocation and positions',
        description:
          'Valued from the latest holdings snapshot at the latest instrument prices. ' +
          '`marketValue = quantity × lastPrice`, `unrealisedPnl = quantity × (lastPrice − avgCost)`. ' +
          'Amounts are decimal strings in `currency`. `snapshotDate`/`priceAsOf` show data freshness ' +
          'and are null when the customer has no holdings.',
        params: customerIdParam,
        response: { 200: portfolio, 404: errorResponse },
      },
    },
    async (req) => {
      if (!(await customerExists(app.db, req.params.customerId))) {
        throw notFound(`Customer ${req.params.customerId}`);
      }
      return getPortfolio(app.db, req.params.customerId);
    },
  );
};
