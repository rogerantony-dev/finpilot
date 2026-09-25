import { transactionStatus, transactionType, type Transaction } from '@finpilot/shared';
import { useParams } from 'react-router';
import {
  ActiveFilters,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  Select,
  SkeletonRows,
  SortableTh,
  Table,
  Td,
  Th,
  Tr,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDate, formatMoney, formatQuantity, humanize } from '../../lib/format';
import { useUrlState } from '../../lib/use-url-state';
import { useInstruments, usePortfolio, useTransactions } from './api';

const FILTERS = [
  'from',
  'to',
  'accountId',
  'instrumentId',
  'type',
  'status',
  'sort',
  'order',
] as const;
const PAGE_SIZE = 25;

const typeOptions = [
  { value: '', label: 'All types' },
  ...transactionType.options.map((t) => ({ value: t, label: humanize(t) })),
];
const statusOptions = [
  { value: '', label: 'All statuses' },
  ...transactionStatus.options.map((s) => ({ value: s, label: humanize(s) })),
];

export function TransactionsPage() {
  const { customerId = '' } = useParams();
  const { values, page, update } = useUrlState(FILTERS);
  const portfolio = usePortfolio(customerId);
  const instruments = useInstruments();

  const sort = values.sort === 'amount' ? 'amount' : 'trade_date';
  const order = values.order === 'asc' ? 'asc' : 'desc';
  const invalidRange = Boolean(values.from && values.to && values.from > values.to);

  const txs = useTransactions(
    customerId,
    {
      from: values.from || undefined,
      to: values.to || undefined,
      accountId: values.accountId || undefined,
      instrumentId: values.instrumentId || undefined,
      type: transactionType.safeParse(values.type).data,
      status: transactionStatus.safeParse(values.status).data,
      sort,
      order,
      page,
      pageSize: PAGE_SIZE,
    },
    { enabled: !invalidRange },
  );

  // Each active filter becomes a removable pill; sort order is kept on clear.
  const instrumentLabel = (id: string) =>
    instruments.data?.find((i) => i.instrumentId === id)?.symbol ?? id;
  const activeFilters = [
    values.from && { key: 'from', label: `From ${formatDate(values.from)}` },
    values.to && { key: 'to', label: `To ${formatDate(values.to)}` },
    values.accountId && { key: 'accountId', label: `Account: ${values.accountId}` },
    values.instrumentId && {
      key: 'instrumentId',
      label: `Instrument: ${instrumentLabel(values.instrumentId)}`,
    },
    values.type && { key: 'type', label: `Type: ${humanize(values.type)}` },
    values.status && { key: 'status', label: `Status: ${humanize(values.status)}` },
  ].filter((f): f is { key: string; label: string } => Boolean(f));
  const clearFilters = () =>
    update({ from: '', to: '', accountId: '', instrumentId: '', type: '', status: '' });
  const toggleSort = (key: 'trade_date' | 'amount') =>
    update({ sort: key, order: sort === key && order === 'desc' ? 'asc' : 'desc' });

  return (
    <Card>
      <div className="border-b border-gray-alpha-100">
        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">Transactions</h2>
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <Badge tone="warn">Pending</Badge> not yet settled
              <Badge tone="muted" className="line-through">
                Reversed
              </Badge>{' '}
              cancelled
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Field.Root invalid={invalidRange}>
              <Field.Label>From</Field.Label>
              <Field.Control
                type="date"
                value={values.from}
                onChange={(e) => update({ from: e.target.value })}
                max={values.to || undefined}
              />
            </Field.Root>
            <Field.Root invalid={invalidRange}>
              <Field.Label>To</Field.Label>
              <Field.Control
                type="date"
                value={values.to}
                onChange={(e) => update({ to: e.target.value })}
                min={values.from || undefined}
              />
            </Field.Root>
            <Select
              label="Account"
              value={values.accountId}
              onValueChange={(v) => update({ accountId: v })}
              options={[
                { value: '', label: 'All accounts' },
                ...(portfolio.data?.accounts ?? []).map((a) => ({
                  value: a.accountId,
                  label: a.accountId,
                })),
              ]}
            />
            <Select
              label="Instrument"
              value={values.instrumentId}
              onValueChange={(v) => update({ instrumentId: v })}
              options={[
                { value: '', label: 'All instruments' },
                ...(instruments.data ?? []).map((i) => ({
                  value: i.instrumentId,
                  label: `${i.symbol} · ${i.instrumentName}`,
                })),
              ]}
            />
            <Select
              label="Type"
              value={values.type}
              onValueChange={(v) => update({ type: v })}
              options={typeOptions}
            />
            <Select
              label="Status"
              value={values.status}
              onValueChange={(v) => update({ status: v })}
              options={statusOptions}
            />
          </div>
          {invalidRange && (
            <p role="alert" className="mt-2 text-xs font-medium text-loss">
              "From" must be on or before "To".
            </p>
          )}
        </div>
        <ActiveFilters
          filters={activeFilters}
          onRemove={(key) => update({ [key]: '' })}
          onClearAll={clearFilters}
        />
      </div>

      {txs.isError ? (
        <ErrorState error={txs.error} onRetry={() => txs.refetch()} />
      ) : (
        <>
          <Table aria-busy={txs.isFetching}>
            <caption className="sr-only">
              Transactions, filtered and paginated on the server
            </caption>
            <thead>
              <tr>
                <SortableTh
                  label="Date"
                  active={sort === 'trade_date'}
                  direction={order}
                  onSort={() => toggleSort('trade_date')}
                />
                <Th>Type</Th>
                <Th>Instrument</Th>
                <Th className="hidden md:table-cell">Account</Th>
                <Th numeric>Qty</Th>
                <Th numeric className="hidden sm:table-cell">
                  Price
                </Th>
                <SortableTh
                  numeric
                  label="Amount"
                  active={sort === 'amount'}
                  direction={order}
                  onSort={() => toggleSort('amount')}
                />
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className={txs.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
              {txs.isPending && !invalidRange ? (
                <SkeletonRows columns={8} />
              ) : (
                txs.data?.data.map((t) => <TxRow key={t.transactionId} t={t} />)
              )}
            </tbody>
          </Table>
          {txs.data?.page.totalItems === 0 && (
            <EmptyState title="No transactions match">
              Widen the date range or clear some filters.
            </EmptyState>
          )}
          {txs.data && txs.data.page.totalItems > 0 && (
            <Pagination
              page={txs.data.page}
              onPageChange={(p) => update({ page: p })}
              itemLabel="transactions"
            />
          )}
        </>
      )}
    </Card>
  );
}

const typeClass: Record<string, string> = {
  BUY: 'text-gray-900',
  SELL: 'text-gray-900',
  DIVIDEND: 'text-gain',
  FEE: 'text-loss',
};

function TxRow({ t }: { t: Transaction }) {
  const reversed = t.status === 'REVERSED';
  const cash = t.transactionType === 'DIVIDEND' || t.transactionType === 'FEE';
  return (
    <Tr className={cn(reversed && 'text-gray-500', t.status === 'PENDING' && 'bg-amber-100/40')}>
      <Td className="tabular-nums whitespace-nowrap">
        <time dateTime={t.tradeDate}>{formatDate(t.tradeDate)}</time>
        <span className="block font-mono text-[10px] text-gray-500">{t.transactionId}</span>
      </Td>
      <Td className={cn('text-13 font-450', !reversed && typeClass[t.transactionType])}>
        {humanize(t.transactionType)}
      </Td>
      <Td>
        <span className="block max-w-56 truncate">{t.instrumentName}</span>
        <span className="font-mono text-[11px] text-gray-500">{t.symbol}</span>
      </Td>
      <Td className="hidden font-mono text-xs text-gray-500 md:table-cell">{t.accountId}</Td>
      <Td numeric>
        {cash ? <span className="text-gray-500">—</span> : formatQuantity(t.quantity)}
      </Td>
      <Td numeric className="hidden sm:table-cell">
        {cash ? <span className="text-gray-500">—</span> : formatMoney(t.price)}
      </Td>
      <Td numeric className={cn('font-medium', reversed && 'line-through decoration-red-500/60')}>
        {formatMoney(t.amount)}
      </Td>
      <Td>
        {t.status === 'SETTLED' && <Badge tone="neutral">Settled</Badge>}
        {t.status === 'PENDING' && <Badge tone="warn">Pending</Badge>}
        {reversed && (
          <Badge tone="muted" className="line-through">
            Reversed
          </Badge>
        )}
      </Td>
    </Tr>
  );
}
