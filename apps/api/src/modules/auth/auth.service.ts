import type { SessionUser } from '@finpilot/shared';
import { sql } from 'kysely';
import type { Db } from '../../db/index.js';
import { DUMMY_HASH, verifyPassword } from '../../lib/password.js';

/** Returns the user when the email and password match, otherwise null. */
export async function verifyCredentials(
  db: Db,
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await db
    .selectFrom('users')
    .select(['user_id', 'email', 'full_name', 'role', 'password_hash'])
    .where(sql<string>`lower(email)`, '=', email.toLowerCase())
    .executeTakeFirst();

  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) return null;

  return {
    id: user.user_id,
    email: user.email,
    fullName: user.full_name,
    role: user.role as SessionUser['role'],
  };
}
