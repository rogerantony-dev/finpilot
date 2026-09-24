import { z } from 'zod';

// Money, prices and quantities travel as decimal strings ("12500.50") so no
// value is ever rounded through a floating-point number.
export const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, { error: 'Must be a number' })
  .meta({ example: '12500.50' });

export const isoDate = z.iso
  .date({ error: 'Must be a date (YYYY-MM-DD)' })
  .meta({ example: '2026-09-18' });

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const pageInfo = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
});
export type PageInfo = z.infer<typeof pageInfo>;

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), page: pageInfo });

export const errorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof errorCode>;

/** Every error response has this shape. */
export const errorResponse = z
  .object({
    error: z.object({
      code: errorCode,
      message: z.string(),
      details: z.array(z.object({ field: z.string().optional(), message: z.string() })).optional(),
      requestId: z.string(),
    }),
  })
  .meta({ id: 'ErrorResponse' });
export type ErrorResponse = z.infer<typeof errorResponse>;
