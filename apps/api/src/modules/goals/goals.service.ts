import type { Goal, GoalUpdate } from '@finpilot/shared';
import type { z } from 'zod';
import type { goalCreate } from '@finpilot/shared';
import type { Db } from '../../db/index.js';
import { todayIso } from '../../lib/dates.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import { customerExists } from '../customers/customers.repository.js';
import { findGoal, insertGoal, listGoals, updateGoal } from './goals.repository.js';

// Business rules on top of the field validation in the shared Zod schemas
// (which already guarantee target > 0, funded >= 0, valid enums and dates):
//  - a goal's target date cannot be set in the past; an existing goal that
//    has passed its date is kept and flagged "overdue" rather than rejected
//  - funded above target is allowed (the goal is met) and flagged "overfunded"

function assertTargetDateNotPast(targetDate: string) {
  const today = todayIso();
  if (targetDate < today) {
    throw unprocessable('Target date cannot be in the past', [
      { field: 'targetDate', message: `Choose a date on or after ${today}` },
    ]);
  }
}

export async function getCustomerGoals(db: Db, customerId: string): Promise<Goal[]> {
  if (!(await customerExists(db, customerId))) throw notFound(`Customer ${customerId}`);
  return listGoals(db, customerId);
}

export async function createGoal(
  db: Db,
  customerId: string,
  input: z.output<typeof goalCreate>,
): Promise<Goal> {
  if (!(await customerExists(db, customerId))) throw notFound(`Customer ${customerId}`);
  assertTargetDateNotPast(input.targetDate);
  const goalId = await insertGoal(db, customerId, input);
  return (await findGoal(db, goalId))!;
}

export async function editGoal(db: Db, goalId: string, changes: GoalUpdate): Promise<Goal> {
  const existing = await findGoal(db, goalId);
  if (!existing) throw notFound(`Goal ${goalId}`);
  if (changes.targetDate !== undefined && changes.targetDate !== existing.targetDate) {
    assertTargetDateNotPast(changes.targetDate);
  }
  await updateGoal(db, goalId, changes);
  return (await findGoal(db, goalId))!;
}
