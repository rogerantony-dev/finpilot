import { execFileSync } from 'node:child_process';

// Recreate the test database from the migrations before the test run, so tests
// always run against exactly the schema a clean install would have.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  const dbmate = (command: string) =>
    execFileSync(
      'dbmate',
      ['--url', url, '--migrations-dir', '../../db/migrations', '--no-dump-schema', command],
      { stdio: 'pipe' },
    );
  dbmate('drop');
  dbmate('create');
  dbmate('up');
}
