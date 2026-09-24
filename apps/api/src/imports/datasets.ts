import { sql, type Transaction } from 'kysely';
import { z } from 'zod';
import type { DB } from '../db/schema.js';
import {
  REASON,
  dateField,
  decimalField,
  enumField,
  idField,
  integerField,
  num,
  optionalText,
  textField,
  withReason,
} from './fields.js';

// One definition per CSV dataset: its columns, row validation, natural key and
// foreign-key references. The import pipeline (import-service.ts) is generic
// and driven entirely by these definitions.

export type DatasetName =
  | 'customers'
  | 'risk_profiles'
  | 'accounts'
  | 'instruments'
  | 'holdings'
  | 'transactions'
  | 'goals';

export interface Reference {
  column: string;
  table: keyof DB;
  refColumn: string;
  label: string;
}

export interface DatasetDefinition {
  name: DatasetName;
  table: keyof DB;
  /** CSV header columns; they match the target table's column names. */
  columns: readonly string[];
  /** Natural key: duplicates in the file or already in the table are rejected. */
  key: readonly string[];
  /** Row validation. `asOf` is the import date, used to reject future dates. */
  rowSchema: (asOf: string) => z.ZodType<Record<string, string | null>>;
  references: readonly Reference[];
  afterMerge?: (trx: Transaction<DB>) => Promise<void>;
}

const notInFuture = (field: string, asOf: string, label: string) =>
  function (row: Record<string, string | null>, ctx: z.RefinementCtx) {
    const value = row[field];
    if (value && value > asOf) {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: `${label} ${value} is in the future (import date ${asOf})`,
        ...withReason(REASON.FUTURE_DATE),
      });
    }
  };

const customers: DatasetDefinition = {
  name: 'customers',
  table: 'customers',
  columns: [
    'customer_id',
    'full_name',
    'email',
    'phone',
    'city',
    'state',
    'date_of_birth',
    'onboarded_at',
    'kyc_status',
    'segment',
  ],
  key: ['customer_id'],
  references: [],
  rowSchema: (asOf) =>
    z
      .object({
        customer_id: idField('customer_id', /^C\d{4,}$/),
        full_name: textField('full_name'),
        email: textField('email').regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, {
          error: 'email is not valid',
        }),
        phone: textField('phone').regex(/^\+\d{8,15}$/, {
          error: 'phone must be in +<digits> form',
        }),
        city: textField('city'),
        state: textField('state').regex(/^[A-Z]{2}$/, { error: 'state must be a 2-letter code' }),
        date_of_birth: dateField('date_of_birth'),
        onboarded_at: dateField('onboarded_at'),
        kyc_status: enumField('kyc_status', ['VERIFIED', 'PENDING', 'REVIEW']),
        segment: enumField('segment', ['Mass', 'Affluent', 'HNI']),
      })
      .superRefine(notInFuture('onboarded_at', asOf, 'onboarded_at'))
      .superRefine((row, ctx) => {
        if (row.date_of_birth >= row.onboarded_at) {
          ctx.addIssue({
            code: 'custom',
            path: ['date_of_birth'],
            message: 'date_of_birth must be before onboarded_at',
            ...withReason(REASON.INCONSISTENT_ROW),
          });
        }
      }),
};

const riskProfiles: DatasetDefinition = {
  name: 'risk_profiles',
  table: 'risk_profiles',
  columns: [
    'customer_id',
    'risk_score',
    'risk_level',
    'assessed_at',
    'horizon_years',
    'liquidity_need',
  ],
  key: ['customer_id', 'assessed_at'],
  references: [
    { column: 'customer_id', table: 'customers', refColumn: 'customer_id', label: 'customer' },
  ],
  rowSchema: (asOf) =>
    z
      .object({
        customer_id: idField('customer_id', /^C\d{4,}$/),
        risk_score: integerField('risk_score').refine((v) => num(v) >= 0 && num(v) <= 100, {
          error: 'risk_score must be between 0 and 100',
          ...withReason(REASON.OUT_OF_RANGE),
        }),
        risk_level: enumField('risk_level', ['Conservative', 'Moderate', 'Growth', 'Aggressive']),
        assessed_at: dateField('assessed_at'),
        horizon_years: integerField('horizon_years').refine((v) => num(v) >= 0 && num(v) <= 100, {
          error: 'horizon_years must be between 0 and 100',
          ...withReason(REASON.OUT_OF_RANGE),
        }),
        liquidity_need: enumField('liquidity_need', ['LOW', 'MEDIUM', 'HIGH']),
      })
      .superRefine(notInFuture('assessed_at', asOf, 'assessed_at')),
};

const accounts: DatasetDefinition = {
  name: 'accounts',
  table: 'accounts',
  columns: [
    'account_id',
    'customer_id',
    'account_type',
    'provider',
    'opened_at',
    'status',
    'base_currency',
  ],
  key: ['account_id'],
  references: [
    { column: 'customer_id', table: 'customers', refColumn: 'customer_id', label: 'customer' },
  ],
  rowSchema: (asOf) =>
    z
      .object({
        account_id: idField('account_id', /^A\d{5,}$/),
        customer_id: idField('customer_id', /^C\d{4,}$/),
        account_type: enumField('account_type', ['BROKERAGE', 'MUTUAL_FUND', 'RETIREMENT']),
        provider: textField('provider'),
        opened_at: dateField('opened_at'),
        status: enumField('status', ['ACTIVE', 'DORMANT', 'CLOSED']),
        base_currency: textField('base_currency').regex(/^[A-Z]{3}$/, {
          error: 'base_currency must be a 3-letter ISO code',
        }),
      })
      .superRefine(notInFuture('opened_at', asOf, 'opened_at')),
};

const instruments: DatasetDefinition = {
  name: 'instruments',
  table: 'instruments',
  columns: [
    'instrument_id',
    'symbol',
    'instrument_name',
    'asset_class',
    'sector',
    'exchange',
    'currency',
    'last_price',
    'price_as_of',
    'risk_band',
  ],
  key: ['instrument_id'],
  references: [],
  rowSchema: (asOf) =>
    z
      .object({
        instrument_id: idField('instrument_id', /^I\d{4,}$/),
        symbol: textField('symbol'),
        instrument_name: textField('instrument_name'),
        asset_class: enumField('asset_class', [
          'EQUITY',
          'ETF',
          'MUTUAL_FUND',
          'BOND',
          'REIT',
          'GSEC',
        ]),
        sector: optionalText(),
        exchange: enumField('exchange', ['NSE', 'BSE', 'OTC']),
        currency: textField('currency').regex(/^[A-Z]{3}$/, {
          error: 'currency must be a 3-letter ISO code',
        }),
        last_price: decimalField('last_price').refine((v) => num(v) > 0, {
          error: 'last_price must be greater than 0',
          ...withReason(REASON.OUT_OF_RANGE),
        }),
        price_as_of: dateField('price_as_of'),
        risk_band: enumField('risk_band', ['LOW', 'MEDIUM', 'HIGH']),
      })
      .superRefine(notInFuture('price_as_of', asOf, 'price_as_of'))
      .superRefine((row, ctx) => {
        if (row.sector && row.asset_class !== 'EQUITY') {
          ctx.addIssue({
            code: 'custom',
            path: ['sector'],
            message: 'sector applies to EQUITY instruments only',
            ...withReason(REASON.INCONSISTENT_ROW),
          });
        }
      }),
};

const holdings: DatasetDefinition = {
  name: 'holdings',
  table: 'holdings',
  columns: ['account_id', 'instrument_id', 'quantity', 'avg_cost', 'snapshot_date'],
  key: ['account_id', 'instrument_id', 'snapshot_date'],
  references: [
    { column: 'account_id', table: 'accounts', refColumn: 'account_id', label: 'account' },
    {
      column: 'instrument_id',
      table: 'instruments',
      refColumn: 'instrument_id',
      label: 'instrument',
    },
  ],
  rowSchema: (asOf) =>
    z
      .object({
        account_id: idField('account_id', /^A\d{5,}$/),
        instrument_id: idField('instrument_id', /^I\d{4,}$/),
        quantity: decimalField('quantity').refine((v) => num(v) > 0, {
          error: 'quantity must be greater than 0',
          ...withReason(REASON.OUT_OF_RANGE),
        }),
        avg_cost: decimalField('avg_cost').refine((v) => num(v) >= 0, {
          error: 'avg_cost cannot be negative',
          ...withReason(REASON.OUT_OF_RANGE),
        }),
        snapshot_date: dateField('snapshot_date'),
      })
      .superRefine(notInFuture('snapshot_date', asOf, 'snapshot_date')),
};

const transactions: DatasetDefinition = {
  name: 'transactions',
  table: 'transactions',
  columns: [
    'transaction_id',
    'account_id',
    'instrument_id',
    'transaction_type',
    'trade_date',
    'quantity',
    'price',
    'amount',
    'status',
  ],
  key: ['transaction_id'],
  references: [
    { column: 'account_id', table: 'accounts', refColumn: 'account_id', label: 'account' },
    {
      column: 'instrument_id',
      table: 'instruments',
      refColumn: 'instrument_id',
      label: 'instrument',
    },
  ],
  rowSchema: (asOf) =>
    z
      .object({
        transaction_id: idField('transaction_id', /^T\d{7,}$/),
        account_id: idField('account_id', /^A\d{5,}$/),
        instrument_id: idField('instrument_id', /^I\d{4,}$/),
        transaction_type: enumField('transaction_type', ['BUY', 'SELL', 'DIVIDEND', 'FEE']),
        trade_date: dateField('trade_date'),
        quantity: decimalField('quantity'),
        price: decimalField('price'),
        amount: decimalField('amount'),
        status: enumField('status', ['SETTLED', 'PENDING', 'REVERSED']),
      })
      .superRefine(notInFuture('trade_date', asOf, 'trade_date'))
      .superRefine((row, ctx) => {
        const [quantity, price, amount] = [num(row.quantity), num(row.price), num(row.amount)];
        if (amount < 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['amount'],
            message: `amount ${row.amount} is negative; amounts are positive and direction comes from transaction_type`,
            ...withReason(REASON.NEGATIVE_AMOUNT),
          });
        } else if (amount === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['amount'],
            message: 'amount must be greater than 0',
            ...withReason(REASON.OUT_OF_RANGE),
          });
        }
        const isTrade = row.transaction_type === 'BUY' || row.transaction_type === 'SELL';
        if (isTrade && (quantity <= 0 || price <= 0)) {
          ctx.addIssue({
            code: 'custom',
            path: ['quantity'],
            message: `${row.transaction_type} needs a quantity and price greater than 0`,
            ...withReason(REASON.INCONSISTENT_ROW),
          });
        } else if (!isTrade && (quantity !== 0 || price !== 0)) {
          ctx.addIssue({
            code: 'custom',
            path: ['quantity'],
            message: `${row.transaction_type} is a cash event; quantity and price must be 0`,
            ...withReason(REASON.INCONSISTENT_ROW),
          });
        } else if (isTrade && amount > 0 && Math.abs(quantity * price - amount) > 0.05) {
          ctx.addIssue({
            code: 'custom',
            path: ['amount'],
            message: `amount ${row.amount} does not equal quantity × price (${(quantity * price).toFixed(2)})`,
            ...withReason(REASON.INCONSISTENT_ROW),
          });
        }
      }),
};

const goals: DatasetDefinition = {
  name: 'goals',
  table: 'goals',
  columns: [
    'goal_id',
    'customer_id',
    'goal_type',
    'goal_name',
    'target_amount',
    'current_funded_amount',
    'target_date',
    'priority',
  ],
  key: ['goal_id'],
  references: [
    { column: 'customer_id', table: 'customers', refColumn: 'customer_id', label: 'customer' },
  ],
  rowSchema: () =>
    z.object({
      goal_id: idField('goal_id', /^G\d{5,}$/),
      customer_id: idField('customer_id', /^C\d{4,}$/),
      goal_type: enumField('goal_type', [
        'RETIREMENT',
        'EDUCATION',
        'HOME_PURCHASE',
        'EMERGENCY_FUND',
        'WEALTH_CREATION',
        'TRAVEL',
      ]),
      goal_name: textField('goal_name').max(100, {
        error: 'goal_name is longer than 100 characters',
      }),
      target_amount: decimalField('target_amount').refine((v) => num(v) > 0, {
        error: 'target_amount must be greater than 0',
        ...withReason(REASON.OUT_OF_RANGE),
      }),
      current_funded_amount: decimalField('current_funded_amount').refine((v) => num(v) >= 0, {
        error: 'current_funded_amount cannot be negative',
        ...withReason(REASON.OUT_OF_RANGE),
      }),
      target_date: dateField('target_date'),
      priority: enumField('priority', ['LOW', 'MEDIUM', 'HIGH']),
    }),
  // Goals created in the app get IDs from goal_id_seq; move it past imported IDs.
  afterMerge: async (trx) => {
    await sql`
      SELECT setval('goal_id_seq', greatest(
        (SELECT coalesce(max(substr(goal_id, 2)::int), 0) FROM goals),
        (SELECT last_value FROM goal_id_seq)))
    `.execute(trx);
  },
};

export const DATASETS = {
  customers,
  risk_profiles: riskProfiles,
  accounts,
  instruments,
  holdings,
  transactions,
  goals,
} as const satisfies Record<DatasetName, DatasetDefinition>;

/** Load order that satisfies foreign keys. */
export const LOAD_ORDER: readonly DatasetName[] = [
  'customers',
  'risk_profiles',
  'accounts',
  'instruments',
  'holdings',
  'transactions',
  'goals',
];
