import type { Goal } from '@finpilot/shared';
import type { Selectable } from 'kysely';
import type { Db } from '../../db/index.js';
import type { VGoalStatus } from '../../db/schema.js';

// Goals are read from v_goal_status, which adds funded % and the
// overdue / over-funded / under-funded / name-type flags.

const toGoal = (g: Selectable<VGoalStatus>): Goal => ({
  goalId: g.goal_id!,
  customerId: g.customer_id!,
  goalType: g.goal_type as Goal['goalType'],
  goalName: g.goal_name!,
  targetAmount: g.target_amount!,
  currentFundedAmount: g.current_funded_amount!,
  targetDate: g.target_date!,
  priority: g.priority as Goal['priority'],
  fundedPct: g.funded_pct!,
  flags: {
    overdue: g.is_overdue!,
    overfunded: g.is_overfunded!,
    highPriorityUnderfunded: g.is_high_priority_underfunded!,
    nameTypeMismatch: g.is_name_type_mismatch!,
  },
  updatedAt: g.updated_at!.toISOString(),
});

export async function listGoals(db: Db, customerId: string): Promise<Goal[]> {
  const rows = await db
    .selectFrom('v_goal_status')
    .selectAll()
    .where('customer_id', '=', customerId)
    .orderBy('target_date')
    .orderBy('goal_id')
    .execute();
  return rows.map(toGoal);
}

export async function findGoal(db: Db, goalId: string): Promise<Goal | null> {
  const row = await db
    .selectFrom('v_goal_status')
    .selectAll()
    .where('goal_id', '=', goalId)
    .executeTakeFirst();
  return row ? toGoal(row) : null;
}

export interface GoalValues {
  goalType: string;
  goalName: string;
  targetAmount: string;
  currentFundedAmount: string;
  targetDate: string;
  priority: string;
}

export async function insertGoal(db: Db, customerId: string, v: GoalValues): Promise<string> {
  const { goal_id } = await db
    .insertInto('goals')
    .values({
      customer_id: customerId,
      goal_type: v.goalType,
      goal_name: v.goalName,
      target_amount: v.targetAmount,
      current_funded_amount: v.currentFundedAmount,
      target_date: v.targetDate,
      priority: v.priority,
    })
    .returning('goal_id')
    .executeTakeFirstOrThrow();
  return goal_id;
}

export async function updateGoal(db: Db, goalId: string, v: Partial<GoalValues>): Promise<void> {
  await db
    .updateTable('goals')
    .set({
      ...(v.goalType !== undefined && { goal_type: v.goalType }),
      ...(v.goalName !== undefined && { goal_name: v.goalName }),
      ...(v.targetAmount !== undefined && { target_amount: v.targetAmount }),
      ...(v.currentFundedAmount !== undefined && { current_funded_amount: v.currentFundedAmount }),
      ...(v.targetDate !== undefined && { target_date: v.targetDate }),
      ...(v.priority !== undefined && { priority: v.priority }),
      updated_at: new Date(),
    })
    .where('goal_id', '=', goalId)
    .execute();
}
