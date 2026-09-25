import type { ImportBatch, ImportResult } from '@finpilot/shared';
import { CheckCircle2, Download, FileSpreadsheet, Info, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Progress,
  SkeletonRows,
  Table,
  Td,
  Th,
  Tr,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatBytes, formatDateTime } from '../../lib/format';
import { useBatchRejects, useImportBatches, useImportTransactions } from './api';
import { RejectsTable, rejectsToCsv } from './RejectsTable';

const MAX_BYTES = 5 * 1024 * 1024;
const COLUMNS =
  'transaction_id, account_id, instrument_id, transaction_type, trade_date, quantity, price, amount, status';

interface Selected {
  file: File;
  content: string;
  rows: number;
}

export function ImportPage() {
  const importer = useImportTransactions();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function choose(file: File | undefined) {
    importer.reset();
    setSelected(null);
    setFileError(null);
    if (!file) return;
    // Quick checks before uploading; the server validates every row.
    if (!file.name.toLowerCase().endsWith('.csv')) return setFileError('Choose a .csv file.');
    if (file.size === 0) return setFileError('This file is empty.');
    if (file.size > MAX_BYTES)
      return setFileError(`This file is ${formatBytes(file.size)}; the limit is 5 MB.`);
    const content = await file.text();
    const rows = content.split(/\r?\n/).filter((l) => l.trim()).length - 1;
    setSelected({ file, content, rows: Math.max(0, rows) });
  }

  function clear() {
    importer.reset();
    setSelected(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="grid gap-6 animate-rise">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Import transactions</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Upload a daily transactions file. Every row is validated; valid rows are added to the
          ledger in one step and rejected rows are listed with the reason. Existing transactions are
          never overwritten, and uploading the same file twice changes nothing.
        </p>
      </header>

      <Card>
        <CardHeader title="1 · Choose a file" />
        <div className="grid gap-4 p-5">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void choose(e.dataTransfer.files[0]);
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-paper/50 px-6 py-8 text-center transition-colors',
              'hover:border-accent/60 focus-within:outline-2 focus-within:outline-accent',
              dragging && 'border-accent bg-accent-soft/40',
            )}
          >
            <Upload className="text-muted" size={24} aria-hidden />
            <span className="font-medium">Choose a CSV file or drop it here</span>
            <span className="text-xs text-muted">.csv, up to 5 MB</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file to import"
              className="sr-only"
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-muted">
            Required columns: <code className="font-mono text-[11px] text-ink-soft">{COLUMNS}</code>
          </p>

          {fileError && (
            <p
              role="alert"
              className="rounded-md border border-loss/25 bg-loss-soft px-3 py-2 text-sm text-loss"
            >
              {fileError}
            </p>
          )}

          {selected && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-4">
              <FileSpreadsheet className="text-accent" size={28} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{selected.file.name}</p>
                <p className="numeric text-xs text-muted">
                  {formatBytes(selected.file.size)} · {selected.rows.toLocaleString('en-IN')} data
                  rows
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={clear} disabled={importer.isPending}>
                <X size={14} aria-hidden /> Remove
              </Button>
              <Button
                onClick={() => importer.mutate(selected)}
                disabled={importer.isPending || importer.isSuccess}
              >
                {importer.isPending ? 'Importing…' : 'Validate & import'}
              </Button>
            </div>
          )}

          {importer.isPending && selected && (
            <Progress
              value={null}
              label={`Validating and importing ${selected.rows.toLocaleString('en-IN')} rows…`}
            />
          )}

          {importer.isError && (
            <p
              role="alert"
              className="rounded-md border border-loss/25 bg-loss-soft px-3 py-2 text-sm text-loss"
            >
              {importer.error instanceof ApiError && importer.error.status === 422
                ? `The file was not imported: ${importer.error.message}`
                : importer.error.message}
            </p>
          )}
        </div>
      </Card>

      {importer.data && <ResultCard result={importer.data} />}

      <History />
    </div>
  );
}

function ResultCard({ result: r }: { result: ImportResult }) {
  const already = r.status === 'ALREADY_IMPORTED';

  function download() {
    const blob = new Blob([rejectsToCsv(r.rejects)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `rejected-rows-batch-${r.batchId}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card aria-live="polite">
      <CardHeader title="2 · Result" />
      <div className="grid gap-5 p-5">
        <div className="flex items-start gap-3">
          {already ? (
            <Info className="mt-0.5 text-warn" size={22} aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 text-gain" size={22} aria-hidden />
          )}
          <div>
            <p className="font-display text-2xl">
              {already ? 'Already imported, nothing changed' : `Imported as batch #${r.batchId}`}
            </p>
            <p className="text-sm text-muted">
              {already
                ? `This exact file was imported before as batch #${r.batchId} (${r.fileName}). The counts below are from that import.`
                : `${r.fileName}: valid rows were added to the ledger; rejected rows were not.`}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Rows in file" value={r.totalRows} />
          <Stat label="Accepted" value={r.acceptedRows} tone="gain" />
          <Stat
            label="Rejected"
            value={r.rejectedRows}
            tone={r.rejectedRows ? 'loss' : undefined}
          />
        </dl>

        {!already && r.rejectedRows > 0 && (
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-4 py-2.5">
              <p className="text-sm font-medium">
                Rejected rows{' '}
                {r.rejectsTruncated && (
                  <span className="font-normal text-muted">
                    (first {r.rejects.length}; see all in the history below)
                  </span>
                )}
              </p>
              <Button variant="secondary" size="sm" onClick={download}>
                <Download size={14} aria-hidden /> Download CSV
              </Button>
            </div>
            <RejectsTable rows={r.rejects} caption={`Rejected rows of batch ${r.batchId}`} />
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'gain' | 'loss' }) {
  return (
    <div className="rounded-lg border border-line bg-paper/40 p-4">
      <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</dt>
      <dd
        className={cn(
          'numeric mt-1 font-display text-3xl',
          tone === 'gain' && 'text-gain',
          tone === 'loss' && 'text-loss',
        )}
      >
        {value.toLocaleString('en-IN')}
      </dd>
    </div>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<ImportBatch | null>(null);
  const batches = useImportBatches(page);

  return (
    <Card>
      <CardHeader title="Import history" />
      {batches.isError ? (
        <ErrorState error={batches.error} onRetry={() => batches.refetch()} />
      ) : (
        <>
          <Table>
            <caption className="sr-only">Previous imports, newest first</caption>
            <thead>
              <tr>
                <Th>Batch</Th>
                <Th>File</Th>
                <Th className="hidden md:table-cell">Dataset</Th>
                <Th numeric>Rows</Th>
                <Th numeric>Accepted</Th>
                <Th numeric>Rejected</Th>
                <Th className="hidden lg:table-cell">By</Th>
                <Th className="hidden sm:table-cell">When</Th>
              </tr>
            </thead>
            <tbody>
              {batches.isPending ? (
                <SkeletonRows columns={8} rows={4} />
              ) : (
                batches.data.data.map((b) => (
                  <Tr key={b.batchId}>
                    <Td className="font-mono text-xs">#{b.batchId}</Td>
                    <Td className="max-w-56 truncate" title={`SHA-256 ${b.fileSha256}`}>
                      {b.fileName}
                    </Td>
                    <Td className="hidden md:table-cell">
                      <Badge tone="muted">{b.dataset.replace('_', ' ')}</Badge>
                    </Td>
                    <Td numeric>{b.totalRows.toLocaleString('en-IN')}</Td>
                    <Td numeric className="text-gain">
                      {b.acceptedRows.toLocaleString('en-IN')}
                    </Td>
                    <Td numeric>
                      {b.rejectedRows > 0 ? (
                        <button
                          type="button"
                          onClick={() => setViewing(b)}
                          className="font-medium text-loss underline decoration-loss/40 underline-offset-4 hover:decoration-loss"
                        >
                          {b.rejectedRows.toLocaleString('en-IN')}
                        </button>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </Td>
                    <Td className="hidden text-muted lg:table-cell">
                      {b.uploadedBy ?? 'Initial seed'}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted sm:table-cell">
                      {formatDateTime(b.finishedAt)}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
          {batches.data?.page.totalItems === 0 && <EmptyState title="No imports yet" />}
          {batches.data && batches.data.page.totalItems > 0 && (
            <Pagination page={batches.data.page} onPageChange={setPage} itemLabel="imports" />
          )}
        </>
      )}

      {viewing && (
        <BatchRejectsDialog
          key={viewing.batchId}
          batch={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </Card>
  );
}

function BatchRejectsDialog({ batch, onClose }: { batch: ImportBatch; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const rejects = useBatchRejects(batch.batchId, page);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Rejected rows · batch #${batch.batchId}`}
      size="lg"
      description={`${batch.fileName} · ${batch.rejectedRows.toLocaleString('en-IN')} of ${batch.totalRows.toLocaleString('en-IN')} rows rejected`}
    >
      <div className="-mx-6 max-h-[60dvh] overflow-y-auto border-y border-line">
        {rejects.isError ? (
          <ErrorState error={rejects.error} onRetry={() => rejects.refetch()} />
        ) : rejects.data ? (
          <RejectsTable
            rows={rejects.data.data}
            caption={`Rejected rows of batch ${batch.batchId}`}
          />
        ) : (
          <Table>
            <tbody>
              <SkeletonRows columns={4} rows={5} />
            </tbody>
          </Table>
        )}
      </div>
      {rejects.data && rejects.data.page.totalPages > 1 && (
        <div className="-mx-6 -mb-2">
          <Pagination page={rejects.data.page} onPageChange={setPage} itemLabel="rejected rows" />
        </div>
      )}
    </Dialog>
  );
}
