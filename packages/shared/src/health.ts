import { z } from 'zod';

export const healthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number(),
  checks: z.object({ database: z.enum(['up', 'down']) }),
});
export type HealthResponse = z.infer<typeof healthResponse>;
