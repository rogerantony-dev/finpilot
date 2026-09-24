import { parse } from 'csv-parse/sync';

export interface CsvRow {
  /** 1-based line number in the file (line 1 is the header). */
  line: number;
  values: Record<string, string>;
}

export interface ParsedCsv {
  header: string[];
  rows: CsvRow[];
}

/** Thrown when the file as a whole is unusable; nothing is imported. */
export class ImportFileError extends Error {
  constructor(
    message: string,
    readonly code: 'EMPTY_FILE' | 'MALFORMED_CSV' | 'UNEXPECTED_HEADER',
  ) {
    super(message);
    this.name = 'ImportFileError';
  }
}

export function parseCsv(content: string, expectedColumns: readonly string[]): ParsedCsv {
  let records: { record: Record<string, string>; info: { lines: number } }[];
  let header: string[] = [];
  try {
    records = parse(content, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
      info: true,
      columns: (h: string[]) => (header = h.map((c) => c.trim())),
    });
  } catch (err) {
    throw new ImportFileError(`File is not valid CSV: ${(err as Error).message}`, 'MALFORMED_CSV');
  }

  if (header.length === 0) throw new ImportFileError('File is empty', 'EMPTY_FILE');

  const missing = expectedColumns.filter((c) => !header.includes(c));
  const unexpected = header.filter((c) => !expectedColumns.includes(c));
  if (missing.length || unexpected.length) {
    throw new ImportFileError(
      `Unexpected header. Missing: [${missing.join(', ')}]; unexpected: [${unexpected.join(', ')}]`,
      'UNEXPECTED_HEADER',
    );
  }

  return { header, rows: records.map((r) => ({ line: r.info.lines, values: r.record })) };
}
