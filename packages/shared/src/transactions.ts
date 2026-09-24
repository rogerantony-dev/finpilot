import { z } from 'zod';
import { decimalString, isoDate, pageQuery, paginated } from './common.js';

export const transactionType = z.enum(['BUY', 'SELL', 'DIVIDEND', 'FEE']);
export const transactionStatus = z.enum(['SETTLED', 'PENDING', 'REVERSED']);

export const transactionListQuery = pageQuery
  .extend({
    from: isoDate.optional().describe('Trade date on or after'),
    to: isoDate.optional().describe('Trade date on or before'),
    accountId: z
      .string()
      .regex(/^A\d{5,}$/)
      .optional(),
    instrumentId: z
      .string()
      .regex(/^I\d{4,}$/)
      .optional(),
    type: transactionType.optional(),
    status: transactionStatus.optional(),
    sort: z.enum(['trade_date', 'amount']).default('trade_date'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    error: '"from" must be on or before "to"',
    path: ['from'],
  });
export type TransactionListQuery = z.infer<typeof transactionListQuery>;

export const transaction = z
  .object({
    transactionId: z.string(),
    accountId: z.string(),
    instrumentId: z.string(),
    symbol: z.string(),
    instrumentName: z.string(),
    transactionType,
    tradeDate: isoDate,
    quantity: decimalString,
    price: decimalString,
    amount: decimalString,
    status: transactionStatus,
  })
  .meta({ id: 'Transaction' });
export type Transaction = z.infer<typeof transaction>;

export const transactionList = paginated(transaction);
export type TransactionList = z.infer<typeof transactionList>;

export const instrumentOption = z
  .object({ instrumentId: z.string(), symbol: z.string(), instrumentName: z.string() })
  .meta({ id: 'InstrumentOption' });
export type InstrumentOption = z.infer<typeof instrumentOption>;
export const instrumentList = z.object({ data: z.array(instrumentOption) });
