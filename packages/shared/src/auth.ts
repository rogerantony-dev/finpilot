import { z } from 'zod';

export const roleSchema = z.enum(['VIEWER', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const loginRequest = z.object({
  email: z.email({ error: 'Enter a valid email address' }).max(254),
  password: z.string().min(1, { error: 'Password is required' }).max(200),
});
export type LoginRequest = z.infer<typeof loginRequest>;

export const sessionUser = z
  .object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
    role: roleSchema,
  })
  .meta({ id: 'SessionUser' });
export type SessionUser = z.infer<typeof sessionUser>;
