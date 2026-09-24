// Types and Zod schemas shared by the API and the web app.
import { z } from 'zod';

export const roleSchema = z.enum(['VIEWER', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number(),
  checks: z.object({
    database: z.enum(['up', 'down']),
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
