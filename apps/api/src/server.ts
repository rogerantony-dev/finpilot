import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = await buildApp(config, db);

// Graceful shutdown: stop accepting requests, finish in-flight ones, close the pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await db.destroy();
    process.exit(0);
  });
}

await app.listen({ host: '0.0.0.0', port: config.API_PORT });
