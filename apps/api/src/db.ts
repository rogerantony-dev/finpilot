import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

// Replaced by generated types (kysely-codegen) once migrations exist.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}

export type Db = Kysely<Database>;

export function createDb(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

export async function pingDb(db: Db): Promise<boolean> {
  try {
    await sql`select 1`.execute(db);
    return true;
  } catch {
    return false;
  }
}
