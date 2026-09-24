import {
  customerIdParam,
  errorResponse,
  goal,
  goalCreate,
  goalIdParam,
  goalList,
  goalUpdate,
} from '@finpilot/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createGoal, editGoal, getCustomerGoals } from './goals.service.js';

const rules =
  'Rules: `targetAmount` > 0 and `currentFundedAmount` >= 0 (decimal strings, max 2 decimals); ' +
  '`targetDate` cannot be set in the past; `goalName` 1–100 characters. ' +
  'Funded above target is allowed and flagged `overfunded`.';

export const goalRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/customers/:customerId/goals',
    {
      schema: {
        tags: ['goals'],
        summary: "List a customer's goals",
        description:
          '`fundedPct = currentFundedAmount / targetAmount × 100`, plus consistency flags.',
        params: customerIdParam,
        response: { 200: goalList, 404: errorResponse },
      },
    },
    async (req) => ({ data: await getCustomerGoals(app.db, req.params.customerId) }),
  );

  app.post(
    '/customers/:customerId/goals',
    {
      schema: {
        tags: ['goals'],
        summary: 'Create a goal',
        description: rules,
        params: customerIdParam,
        body: goalCreate,
        response: { 201: goal, 400: errorResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    async (req, reply) => {
      const created = await createGoal(app.db, req.params.customerId, req.body);
      req.log.info(
        { goalId: created.goalId, customerId: created.customerId, userId: req.user.id },
        'goal created',
      );
      return reply.code(201).send(created);
    },
  );

  app.patch(
    '/goals/:goalId',
    {
      schema: {
        tags: ['goals'],
        summary: 'Edit a goal',
        description: `Send only the fields to change. ${rules}`,
        params: goalIdParam,
        body: goalUpdate,
        response: { 200: goal, 400: errorResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    async (req) => {
      const updated = await editGoal(app.db, req.params.goalId, req.body);
      req.log.info(
        { goalId: updated.goalId, userId: req.user.id, fields: Object.keys(req.body) },
        'goal updated',
      );
      return updated;
    },
  );
};
