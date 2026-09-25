import type { Position } from '@finpilot/shared';
import { useState } from 'react';
import { useParams } from 'react-router';
import {
  Card,
  EmptyState,
  ErrorState,
  Select,
  SkeletonRows,
  SortableTh,
  Table,
  Td,
  Th,
  Tr,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDate, formatMoney, formatPct, formatQuantity, humanize } from '../../lib/format';
import { useUrlState } from '../../lib/use-url-state';
import { usePortfolio } from './api';
import { assetClassColor } from './asset-colors';
import { Pnl } from './Money';

type SortKey = 'instrumentName' | 'assetClass' | 'marketValue' | 'unrealisedPnl';
const NUMERIC: SortKey[] = ['marketValue', 'unrealisedPnl'];

export function PositionsPage() {
  const { customerId = '' } = useParams();
  const portfolio = usePortfolio(customerId);
  const { values, update } = useUrlState(['account'] as const);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'marketValue',
    dir: 'desc',
  });

  if (portfolio.isError)
    return <ErrorState error={portfolio.error} onRetry={() => portfolio.refetch()} />;

  const p = portfolio.data;
  // At most a few dozen rows per customer: filtering and sorting here is instant.
  // Valuation itself (market value, P/L, totals) comes from the database.
  const rows = (p?.positions ?? [])
    .filter((x) => !values.account || x.accountId === values.account)
    .sort((a, b) => compare(a, b, sort.key) * (sort.dir === 'asc' ? 1 : -1));
  const account = p?.accounts.find((a) => a.accountId === values.account);
  const totals = account ?? p?.totals;

  // Same column: flip direction. New column: numbers start high-to-low, text A–Z.
  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: flip(s.dir) }
        : { key, dir: NUMERIC.includes(key) ? 'desc' : 'asc' },
    );

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-alpha-100 p-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Positions</h2>
          {p?.snapshotDate && (
            <p className="text-xs text-gray-500">
              Snapshot {formatDate(p.snapshotDate)} · valued at prices as of{' '}
              {formatDate(p.priceAsOf!)}
            </p>
          )}
        </div>
        <Select
          label="Account"
          className="w-64"
          value={values.account}
          onValueChange={(v) => update({ account: v })}
          options={[
            { value: '', label: 'All accounts' },
            ...(p?.accounts ?? []).map((a) => ({
              value: a.accountId,
              label: `${a.accountId} · ${humanize(a.accountType)}`,
            })),
          ]}
        />
      </div>

      <Table>
        <caption className="sr-only">
          Positions with quantity, cost, latest price, market value and unrealised gain or loss
        </caption>
        <thead>
          <tr>
            <SortableTh
              label="Instrument"
              active={sort.key === 'instrumentName'}
              direction={sort.dir}
              onSort={() => toggle('instrumentName')}
            />
            <SortableTh
              label="Class"
              active={sort.key === 'assetClass'}
              direction={sort.dir}
              onSort={() => toggle('assetClass')}
            />
            <Th className="hidden lg:table-cell">Account</Th>
            <Th numeric>Quantity</Th>
            <Th numeric>Avg cost</Th>
            <Th numeric>Last price</Th>
            <SortableTh
              numeric
              label="Market value"
              active={sort.key === 'marketValue'}
              direction={sort.dir}
              onSort={() => toggle('marketValue')}
            />
            <SortableTh
              numeric
              label="Unrealised P/L"
              active={sort.key === 'unrealisedPnl'}
              direction={sort.dir}
              onSort={() => toggle('unrealisedPnl')}
            />
          </tr>
        </thead>
        <tbody>
          {portfolio.isPending ? (
            <SkeletonRows columns={8} rows={6} />
          ) : (
            rows.map((x) => (
              <Tr key={`${x.accountId}-${x.instrumentId}`}>
                <Td>
                  <p className="font-medium">{x.instrumentName}</p>
                  <p className="font-mono text-[11px] text-gray-500">{x.symbol}</p>
                </Td>
                <Td>
                  <span
                    className={cn(
                      'mr-1.5 inline-block size-2 rounded-full',
                      assetClassColor(x.assetClass).dot,
                    )}
                    aria-hidden
                  />
                  {humanize(x.assetClass)}
                </Td>
                <Td className="hidden font-mono text-xs text-gray-500 lg:table-cell">
                  {x.accountId}
                </Td>
                <Td numeric>{formatQuantity(x.quantity)}</Td>
                <Td numeric className="text-gray-500">
                  {formatMoney(x.avgCost)}
                </Td>
                <Td numeric>{formatMoney(x.lastPrice)}</Td>
                <Td numeric className="font-medium">
                  {formatMoney(x.marketValue)}
                </Td>
                <Td numeric>
                  <Pnl value={x.unrealisedPnl} />
                  <span className="block text-[11px] text-gray-500">
                    {formatPct(pnlPct(x), { signed: true })}
                  </span>
                </Td>
              </Tr>
            ))
          )}
        </tbody>
        {totals && rows.length > 0 && (
          <tfoot>
            <tr className="bg-gray-alpha-50 font-medium">
              <Td colSpan={6} className="text-right text-13 text-gray-500">
                {account ? `Total · ${account.accountId}` : 'Total · all accounts'}
              </Td>
              <Td numeric>{formatMoney(totals.marketValue)}</Td>
              <Td numeric>
                <Pnl value={totals.unrealisedPnl} />
              </Td>
            </tr>
          </tfoot>
        )}
      </Table>
      {p && rows.length === 0 && (
        <EmptyState title="No positions">
          {account
            ? `Account ${account.accountId} holds nothing in this snapshot.`
            : 'This customer holds no positions.'}
        </EmptyState>
      )}
    </Card>
  );
}

const flip = (d: 'asc' | 'desc') => (d === 'asc' ? 'desc' : 'asc');
const pnlPct = (x: Position) =>
  Number(x.costBasis) > 0 ? (Number(x.unrealisedPnl) / Number(x.costBasis)) * 100 : 0;
function compare(a: Position, b: Position, key: SortKey) {
  return NUMERIC.includes(key) ? Number(a[key]) - Number(b[key]) : a[key].localeCompare(b[key]);
}
