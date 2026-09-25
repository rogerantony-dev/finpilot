import type { RejectedRow } from '@finpilot/shared';
import { Badge, Table, Td, Th, Tr } from '../../components/ui';

/** Rejected rows with every reason and the original row, for operations follow-up. */
export function RejectsTable({ rows, caption }: { rows: RejectedRow[]; caption: string }) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <Th numeric className="w-16">
            Line
          </Th>
          <Th className="w-32">Record</Th>
          <Th>Why it was rejected</Th>
          <Th className="w-28">Original row</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.line} className="align-top">
            <Td numeric className="align-top text-gray-500">
              {r.line}
            </Td>
            <Td className="align-top font-mono text-xs">{r.recordKey ?? '—'}</Td>
            <Td className="align-top">
              <ul className="flex flex-col gap-1.5">
                {r.reasons.map((reason, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-2">
                    <Badge tone="loss">{reason.code.replace(/_/g, ' ')}</Badge>
                    <span className="text-sm">{reason.message}</span>
                  </li>
                ))}
              </ul>
            </Td>
            <Td className="align-top">
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-900 select-none">View row</summary>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono">
                  {Object.entries(r.raw).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="break-all">
                        {v === '' ? <em className="text-loss">empty</em> : v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/** CSV of rejected rows (line, record, reasons, then the original columns) for sharing with the data provider. */
export function rejectsToCsv(rows: RejectedRow[]): string {
  const rawColumns = [...new Set(rows.flatMap((r) => Object.keys(r.raw)))];
  const escape = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = ['line', 'record_key', 'reason_codes', 'reasons', ...rawColumns];
  const lines = rows.map((r) =>
    [
      String(r.line),
      r.recordKey ?? '',
      r.reasons.map((x) => x.code).join('; '),
      r.reasons.map((x) => x.message).join('; '),
      ...rawColumns.map((c) => r.raw[c] ?? ''),
    ]
      .map(escape)
      .join(','),
  );
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}
