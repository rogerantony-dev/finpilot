import { describe, expect, it } from 'vitest';
import { rejectsToCsv } from './RejectsTable';

describe('rejectsToCsv', () => {
  it('lists reasons then the original columns, quoting values that need it', () => {
    const csv = rejectsToCsv([
      {
        line: 10,
        recordKey: 'T6000009',
        reasons: [
          {
            code: 'NEGATIVE_AMOUNT',
            field: 'amount',
            message: 'amount -40.00 is negative, not allowed',
          },
        ],
        raw: { transaction_id: 'T6000009', amount: '-40.00' },
      },
      {
        line: 16,
        recordKey: null,
        reasons: [
          { code: 'REQUIRED', field: 'status', message: 'status is required' },
          { code: 'INVALID_FORMAT', message: 'say "hi"' },
        ],
        raw: { transaction_id: '', amount: '5' },
      },
    ]);
    expect(csv.split('\r\n')).toEqual([
      'line,record_key,reason_codes,reasons,transaction_id,amount',
      '10,T6000009,NEGATIVE_AMOUNT,"amount -40.00 is negative, not allowed",T6000009,-40.00',
      '16,,REQUIRED; INVALID_FORMAT,"status is required; say ""hi""",,5',
      '',
    ]);
  });
});
