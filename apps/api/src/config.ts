import { z } from 'zod';

// All configuration comes from environment variables and is validated once at
// start-up, so a missing or malformed value fails fast with a clear message.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  // Set true when served over HTTPS so the session cookie is marked Secure.
  COOKIE_SECURE: z.stringbool().default(false),
  // Set true behind a reverse proxy so req.ip (rate limiting, logs) is the client's IP.
  TRUST_PROXY: z.stringbool().default(false),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  return parsed.data;
}
