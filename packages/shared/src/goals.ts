import { z } from 'zod';
import { decimalString, isoDate } from './common.js';

export const goalType = z.enum([
  'RETIREMENT',
  'EDUCATION',
  'HOME_PURCHASE',
  'EMERGENCY_FUND',
  'WEALTH_CREATION',
  'TRAVEL',
]);
export const goalPriority = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const MAX_AMOUNT = 1_000_000_000_000; // ₹1 lakh crore: a sanity ceiling, not a business rule

/** Positive money amount with at most 2 decimal places, as a string. */
const amount = (label: string, { allowZero }: { allowZero: boolean }) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, { error: `${label} must be a number with up to 2 decimals` })
    .refine((v) => (allowZero ? Number(v) >= 0 : Number(v) > 0), {
      error: allowZero ? `${label} cannot be negative` : `${label} must be greater than 0`,
    })
    .refine((v) => Number(v) <= MAX_AMOUNT, { error: `${label} is unrealistically large` })
    .meta({ example: '2500000.00' });

const goalFields = {
  goalType,
  goalName: z
    .string()
    .trim()
    .min(1, { error: 'Goal name is required' })
    .max(100, { error: 'Goal name must be 100 characters or fewer' }),
  targetAmount: amount('Target amount', { allowZero: false }),
  currentFundedAmount: amount('Funded amount', { allowZero: true }),
  targetDate: isoDate,
  priority: goalPriority,
};

export const goalCreate = z
  .object({ ...goalFields, currentFundedAmount: goalFields.currentFundedAmount.default('0') })
  .meta({ id: 'GoalCreate' });
export type GoalCreate = z.input<typeof goalCreate>;

export const goalUpdate = z
  .object(goalFields)
  .partial()
  .refine((g) => Object.keys(g).length > 0, { error: 'Provide at least one field to update' })
  .meta({ id: 'GoalUpdate' });
export type GoalUpdate = z.infer<typeof goalUpdate>;

export const goalIdParam = z.object({
  goalId: z.string().regex(/^G\d{5,}$/, { error: 'Goal ID looks like G00001' }),
});

export const goal = z
  .object({
    goalId: z.string(),
    customerId: z.string(),
    goalType,
    goalName: z.string(),
    targetAmount: decimalString,
    currentFundedAmount: decimalString,
    targetDate: isoDate,
    priority: goalPriority,
    /** current_funded_amount / target_amount × 100 */
    fundedPct: decimalString,
    flags: z.object({
      overdue: z.boolean(),
      overfunded: z.boolean(),
      highPriorityUnderfunded: z.boolean(),
      nameTypeMismatch: z.boolean(),
    }),
    updatedAt: z.string(),
  })
  .meta({ id: 'Goal' });
export type Goal = z.infer<typeof goal>;

export const goalList = z.object({ data: z.array(goal) });
