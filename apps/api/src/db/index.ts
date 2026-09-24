import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import type { DB } from './schema.js';

// DATE columns come back as 'YYYY-MM-DD' strings, not JS Dates: a calendar date
// has no time zone, and converting it to a Date can shift it by a day.
// NUMERIC stays a string (pg default) so money is never rounded through floats.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export type Database = DB;
export type Db = Kysely<DB>;

export function createDb(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
  });
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

export async function pingDb(db: Db): Promise<boolean> {
  try {
    await sql`select 1`.execute(db);
    return true;
  } catch {
    return false;
  }
}
