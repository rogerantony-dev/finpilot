import type { AccountValuation, Portfolio } from '@finpilot/shared';
import { ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Badge, Card, CardHeader, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { formatDate, formatMoney, formatPct, humanize, signOf } from '../../lib/format';
import { useGoals } from '../goals/api';
import { GoalCard } from '../goals/GoalCard';
import { hasFlags } from '../goals/GoalFlags';
import { usePortfolio } from './api';
import { AllocationChart } from './AllocationChart';
import { Pnl } from './Money';

export function OverviewPage() {
  const { customerId = '' } = useParams();
  const portfolio = usePortfolio(customerId);

  if (portfolio.isPending) return <OverviewSkeleton />;
  if (portfolio.isError)
    return <ErrorState error={portfolio.error} onRetry={() => portfolio.refetch()} />;

  const p = portfolio.data;
  return (
    <div className="grid gap-6">
      <PortfolioSummary portfolio={p} />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader title="Asset allocation" />
          <div className="p-5">
            {p.allocation.length ? (
              <AllocationChart slices={p.allocation} total={p.totals.marketValue} />
            ) : (
              <EmptyState title="No holdings">
                Nothing to allocate: this customer holds no positions.
              </EmptyState>
            )}
          </div>
        </Card>
        <GoalSummary customerId={customerId} />
      </div>

      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading" className="mb-3 text-13 font-medium text-gray-600">
          Accounts
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {p.accounts.map((a) => (
            <AccountCard key={a.accountId} account={a} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PortfolioSummary({ portfolio: p }: { portfolio: Portfolio }) {
  const cost = Number(p.totals.costBasis);
  const returnPct = cost > 0 ? (Number(p.totals.unrealisedPnl) / cost) * 100 : 0;
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-13 font-450 text-gray-500">Portfolio value</p>
          <p className="tabular-nums mt-1.5 text-[32px] leading-none font-semibold tracking-[-0.02em]">
            {formatMoney(p.totals.marketValue)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {p.priceAsOf ? (
              <>
                Prices as of <time dateTime={p.priceAsOf}>{formatDate(p.priceAsOf)}</time> ·
                holdings snapshot{' '}
                <time dateTime={p.snapshotDate!}>{formatDate(p.snapshotDate!)}</time>
              </>
            ) : (
              'No holdings on file'
            )}
          </p>
        </div>
        <Stat label="Unrealised gain / loss">
          <Pnl
            value={p.totals.unrealisedPnl}
            className="text-lg font-semibold tracking-[-0.01em]"
          />
          <span className={signOf(returnPct) < 0 ? 'text-loss' : 'text-gain'}>
            {' '}
            {formatPct(returnPct, { signed: true })}
          </span>
        </Stat>
        <Stat label="Invested (cost basis)">
          <span className="tabular-nums text-lg font-semibold tracking-[-0.01em]">
            {formatMoney(p.totals.costBasis)}
          </span>
          <span className="block text-gray-500">
            {p.totals.positionCount} positions · {p.totals.accountCount} accounts
          </span>
        </Stat>
      </div>
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-gray-alpha-100 md:border-l md:pl-6">
      <p className="text-13 font-450 text-gray-500">{label}</p>
      <p className="mt-2 text-sm">{children}</p>
    </div>
  );
}

const statusTone = { ACTIVE: 'accent', DORMANT: 'warn', CLOSED: 'muted' } as const;

function AccountCard({ account: a }: { account: AccountValuation }) {
  return (
    <article className="rounded-xl border border-gray-alpha-100 bg-gray-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{humanize(a.accountType)}</p>
          <p className="text-xs text-gray-500">
            {a.provider} · <span className="font-mono">{a.accountId}</span>
          </p>
        </div>
        <Badge tone={statusTone[a.status]}>{humanize(a.status)}</Badge>
      </div>
      <p className="tabular-nums mt-4 text-lg font-semibold tracking-[-0.01em]">
        {formatMoney(a.marketValue)}
      </p>
      <p className="mt-0.5 text-sm">
        <Pnl value={a.unrealisedPnl} />{' '}
        <span className="text-gray-500">· {a.positionCount} positions</span>
      </p>
    </article>
  );
}

function GoalSummary({ customerId }: { customerId: string }) {
  const goals = useGoals(customerId);
  // Goals needing attention first, then the nearest target date.
  const top = [...(goals.data ?? [])]
    .sort(
      (a, b) =>
        Number(hasFlags(b)) - Number(hasFlags(a)) || a.targetDate.localeCompare(b.targetDate),
    )
    .slice(0, 2);

  return (
    <Card>
      <CardHeader
        title="Goals"
        action={
          <Link
            to="goals"
            className="inline-flex items-center gap-1 text-sm text-gray-900 hover:underline"
          >
            All goals <ArrowRight size={14} aria-hidden />
          </Link>
        }
      />
      <div className="grid gap-3 p-4">
        {goals.isPending && <Skeleton className="h-36 rounded-xl" />}
        {goals.isError && <ErrorState error={goals.error} onRetry={() => goals.refetch()} />}
        {goals.data?.length === 0 && <EmptyState title="No goals yet" />}
        {top.map((g) => (
          <GoalCard key={g.goalId} goal={g} />
        ))}
      </div>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading portfolio">
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
