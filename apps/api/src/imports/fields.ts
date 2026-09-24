import { z } from 'zod';

// Field validators for CSV values. Everything arrives as a string; numbers are
// validated but kept as strings so NUMERIC precision is never lost.

export const REASON = {
  REQUIRED: 'REQUIRED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_ENUM: 'INVALID_ENUM',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  NEGATIVE_AMOUNT: 'NEGATIVE_AMOUNT',
  FUTURE_DATE: 'FUTURE_DATE',
  INCONSISTENT_ROW: 'INCONSISTENT_ROW',
  DUPLICATE_ROW: 'DUPLICATE_ROW',
  CONFLICTING_DUPLICATE: 'CONFLICTING_DUPLICATE',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  UNKNOWN_REFERENCE: 'UNKNOWN_REFERENCE',
} as const;
export type ReasonCode = (typeof REASON)[keyof typeof REASON];

/** Attach a reason code to a custom validation issue. */
export const withReason = (reason: ReasonCode) => ({ params: { reason } });

const required = (label: string) =>
  z.string({ error: `${label} is required` }).min(1, { error: `${label} is required` });

export const idField = (label: string, pattern: RegExp) =>
  required(label).regex(pattern, { error: `${label} has an invalid format` });

export const textField = (label: string) => required(label);

export const optionalText = () =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v : null));

export const enumField = <const T extends readonly [string, ...string[]]>(
  label: string,
  values: T,
) => z.enum(values, { error: `${label} must be one of ${values.join(', ')}` });

export const dateField = (label: string) =>
  required(label)
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: `${label} must be a date (YYYY-MM-DD)` })
    .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v), {
      error: `${label} is not a real calendar date`,
    });

export const decimalField = (label: string) =>
  required(label).regex(/^-?\d+(\.\d+)?$/, { error: `${label} must be a number` });

export const integerField = (label: string) =>
  required(label).regex(/^-?\d+$/, { error: `${label} must be a whole number` });

export const num = (v: string) => Number(v);
