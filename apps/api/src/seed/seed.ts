// Seeds the database from the supplied CSVs in data/raw, in foreign-key order,
// through the same import pipeline the admin upload uses. Safe to re-run: a file
// that was already imported is skipped (matched by its SHA-256).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createDb } from '../db/index.js';
import { LOAD_ORDER, type DatasetName } from '../imports/datasets.js';
import { importCsv } from '../imports/import-service.js';

const RAW_DIR = fileURLToPath(new URL('../../../../data/raw/', import.meta.url));

const FILES: Record<DatasetName, string> = {
  customers: 'customers.csv',
  risk_profiles: 'risk_profiles.csv',
  accounts: 'accounts.csv',
  instruments: 'instruments.csv',
  holdings: 'holdings_snapshot.csv',
  transactions: 'transactions.csv',
  goals: 'goals.csv',
};

const config = loadConfig();
const db = createDb(config.DATABASE_URL);

try {
  const summary = [];
  for (const dataset of LOAD_ORDER) {
    const fileName = FILES[dataset];
    const content = await readFile(RAW_DIR + fileName, 'utf8');
    const result = await importCsv(db, { dataset, fileName, content });
    summary.push({
      dataset,
      status: result.status,
      batch: result.batchId,
      rows: result.totalRows,
      accepted: result.acceptedRows,
      rejected: result.rejectedRows,
    });
    for (const r of result.rejects) {
      console.log(
        `  ${fileName} line ${r.line} [${r.recordKey}] ${r.reasons.map((x) => `${x.code}: ${x.message}`).join('; ')}`,
      );
    }
  }
  console.table(summary);
} finally {
  await db.destroy();
}
