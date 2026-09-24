import { sql } from 'kysely';
import { createDb, type Db } from '../../src/db/index.js';

export function createTestDb(): Db {
  return createDb(process.env.TEST_DATABASE_URL!);
}

export async function resetDb(db: Db): Promise<void> {
  await sql`
    TRUNCATE import_rejects, import_batches, transactions, holdings, goals,
             risk_profiles, accounts, instruments, customers, users
    RESTART IDENTITY CASCADE`.execute(db);
}
