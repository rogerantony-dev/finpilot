import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Local runs read TEST_DATABASE_URL from the repo-root .env; CI sets it directly.
process.env.TEST_DATABASE_URL ??= loadEnv('test', '../..', '').TEST_DATABASE_URL;

export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share one database; run files one at a time.
    fileParallelism: false,
  },
});
