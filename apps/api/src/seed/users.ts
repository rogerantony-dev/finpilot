import { sql } from 'kysely';
import type { Db } from '../db/index.js';
import { hashPassword } from '../lib/password.js';

export interface DemoUser {
  email: string;
  fullName: string;
  role: 'VIEWER' | 'ADMIN';
  password: string;
}

/** Create demo users if they do not exist yet. Existing users are left unchanged. */
export async function seedUsers(db: Db, users: DemoUser[]): Promise<number> {
  let created = 0;
  for (const u of users) {
    const result = await sql`
      INSERT INTO users (email, full_name, password_hash, role)
      VALUES (${u.email}, ${u.fullName}, ${await hashPassword(u.password)}, ${u.role})
      ON CONFLICT (lower(email)) DO NOTHING`.execute(db);
    created += Number(result.numAffectedRows ?? 0n);
  }
  return created;
}
