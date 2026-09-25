import { z } from 'zod';
import { pageQuery, paginated } from './common.js';

export const importDataset = z.enum([
  'customers',
  'risk_profiles',
  'accounts',
  'instruments',
  'holdings',
  'transactions',
  'goals',
]);

export const rejectReasonCode = z.enum([
  'REQUIRED',
  'INVALID_FORMAT',
  'INVALID_ENUM',
  'OUT_OF_RANGE',
  'NEGATIVE_AMOUNT',
  'FUTURE_DATE',
  'INCONSISTENT_ROW',
  'DUPLICATE_ROW',
  'CONFLICTING_DUPLICATE',
  'ALREADY_EXISTS',
  'UNKNOWN_REFERENCE',
]);

export const rejectedRow = z
  .object({
    /** File line number; line 1 is the header. */
    line: z.number().int(),
    recordKey: z.string().nullable(),
    reasons: z.array(
      z.object({ code: rejectReasonCode, field: z.string().optional(), message: z.string() }),
    ),
    /** The row exactly as it appeared in the file. */
    raw: z.record(z.string(), z.string()),
  })
  .meta({ id: 'RejectedRow' });
export type RejectedRow = z.infer<typeof rejectedRow>;

export const MAX_REJECTS_IN_RESPONSE = 200;

export const importResult = z.object({
  status: z.enum(['IMPORTED', 'ALREADY_IMPORTED']),
  batchId: z.string(),
  dataset: importDataset,
  fileName: z.string(),
  totalRows: z.number().int(),
  acceptedRows: z.number().int(),
  rejectedRows: z.number().int(),
  /** First rejected rows (up to MAX_REJECTS_IN_RESPONSE); the full list is at /admin/imports/{batchId}/rejects. */
  rejects: z.array(rejectedRow),
  rejectsTruncated: z.boolean(),
});
export type ImportResult = z.infer<typeof importResult>;

/** Example: the supplied transactions.csv on a clean database (shown in the OpenAPI docs). */
export const importResultExample = {
  status: 'IMPORTED',
  batchId: '6',
  dataset: 'transactions',
  fileName: 'transactions.csv',
  totalRows: 4554,
  acceptedRows: 4550,
  rejectedRows: 4,
  rejectsTruncated: false,
  rejects: [
    {
      line: 4552,
      recordKey: 'T0000026',
      reasons: [
        {
          code: 'DUPLICATE_ROW',
          field: 'transaction_id',
          message: 'T0000026 is an exact copy of line 27',
        },
      ],
      raw: {
        transaction_id: 'T0000026',
        account_id: 'A00001',
        instrument_id: 'I0037',
        transaction_type: 'SELL',
        trade_date: '2025-10-18',
        quantity: '59.148',
        price: '282.12',
        amount: '16686.83',
        status: 'SETTLED',
      },
    },
    {
      line: 4553,
      recordKey: 'T0004551',
      reasons: [
        {
          code: 'UNKNOWN_REFERENCE',
          field: 'instrument_id',
          message: 'instrument I9999 does not exist',
        },
      ],
      raw: {
        transaction_id: 'T0004551',
        account_id: 'A00001',
        instrument_id: 'I9999',
        transaction_type: 'BUY',
        trade_date: '2026-09-15',
        quantity: '10',
        price: '100',
        amount: '1000',
        status: 'SETTLED',
      },
    },
    {
      line: 4554,
      recordKey: 'T0004552',
      reasons: [
        {
          code: 'NEGATIVE_AMOUNT',
          field: 'amount',
          message:
            'amount -75 is negative; amounts are positive and direction comes from transaction_type',
        },
      ],
      raw: {
        transaction_id: 'T0004552',
        account_id: 'A00002',
        instrument_id: 'I0001',
        transaction_type: 'FEE',
        trade_date: '2026-08-22',
        quantity: '0',
        price: '0',
        amount: '-75',
        status: 'SETTLED',
      },
    },
    {
      line: 4555,
      recordKey: 'T0004553',
      reasons: [
        {
          code: 'FUTURE_DATE',
          field: 'trade_date',
          message: 'trade_date 2027-01-05 is in the future (import date 2026-09-25)',
        },
      ],
      raw: {
        transaction_id: 'T0004553',
        account_id: 'A00003',
        instrument_id: 'I0002',
        transaction_type: 'BUY',
        trade_date: '2027-01-05',
        quantity: '2',
        price: '210',
        amount: '420',
        status: 'PENDING',
      },
    },
  ],
} satisfies ImportResult;

/** importResult with the example attached, for the OpenAPI document. */
export const importResultDocumented = importResult.meta({
  id: 'ImportResult',
  examples: [importResultExample],
});

export const importUploadQuery = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[\w.\- ()]+$/, { error: 'File name contains unsupported characters' })
    .default('upload.csv')
    .describe('Original file name, recorded with the batch'),
});

export const importBatch = z
  .object({
    batchId: z.string(),
    dataset: importDataset,
    fileName: z.string(),
    fileSha256: z.string(),
    totalRows: z.number().int(),
    acceptedRows: z.number().int(),
    rejectedRows: z.number().int(),
    /** Null for the initial seed. */
    uploadedBy: z.string().nullable(),
    startedAt: z.string(),
    finishedAt: z.string(),
  })
  .meta({ id: 'ImportBatch' });
export type ImportBatch = z.infer<typeof importBatch>;

export const importBatchList = paginated(importBatch);
export type ImportBatchList = z.infer<typeof importBatchList>;
export const importBatchListQuery = pageQuery.extend({ dataset: importDataset.optional() });

export const batchIdParam = z.object({
  batchId: z.string().regex(/^\d+$/, { error: 'Batch ID is a number' }),
});
export const rejectList = paginated(rejectedRow);
export type RejectList = z.infer<typeof rejectList>;
