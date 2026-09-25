import type { CustomerDetail } from '@finpilot/shared';
import { ArrowLeft } from 'lucide-react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { EmptyState, ErrorState, Meter, Skeleton } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatDate, humanize } from '../../lib/format';
import { KycBadge, SegmentBadge } from '../customers/badges';
import { useCustomer } from './api';

const tabs = [
  { to: '', label: 'Overview', end: true },
  { to: 'positions', label: 'Positions' },
  { to: 'transactions', label: 'Transactions' },
  { to: 'goals', label: 'Goals' },
];

export function CustomerLayout() {
  const { customerId = '' } = useParams();
  const customer = useCustomer(customerId);

  if (customer.isError) {
    const notFound =
      customer.error instanceof ApiError && [400, 404].includes(customer.error.status);
    return notFound ? (
      <EmptyState title={`No customer ${customerId}`}>
        <Link to="/" className="text-accent underline">
          Back to search
        </Link>
      </EmptyState>
    ) : (
      <ErrorState error={customer.error} onRetry={() => customer.refetch()} />
    );
  }

  return (
    <div className="animate-rise">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden /> Customers
      </Link>

      {customer.isPending ? <HeaderSkeleton /> : <CustomerHeader customer={customer.data} />}

      <nav
        aria-label="Customer sections"
        className="mt-6 mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none]"
      >
        {tabs.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 pt-1 pb-2.5 text-sm whitespace-nowrap transition-colors',
                isActive
                  ? 'border-accent font-medium text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

function CustomerHeader({ customer: c }: { customer: CustomerDetail }) {
  const risk = c.riskProfile;
  return (
    <header className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <p className="font-mono text-xs tracking-wider text-muted">{c.customerId}</p>
        <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          {c.fullName}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <KycBadge status={c.kycStatus} />
          <SegmentBadge segment={c.segment} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <Detail label="Email" value={c.email} />
          <Detail label="Phone" value={c.phone} />
          <Detail label="City" value={`${c.city}, ${c.state}`} />
          <Detail label="Customer since" value={formatDate(c.onboardedAt)} />
        </dl>
      </div>

      <section
        aria-labelledby="risk-heading"
        className="rounded-xl border border-line bg-surface p-4"
      >
        <h2
          id="risk-heading"
          className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
        >
          Risk profile
        </h2>
        {risk ? (
          <>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-3xl">{risk.riskLevel}</span>
              <span className="numeric text-sm text-muted">{risk.riskScore}/100</span>
            </p>
            <Meter
              className="mt-2"
              value={risk.riskScore}
              label="Risk score"
              valueText={`Risk score ${risk.riskScore} out of 100`}
              tone={risk.riskScore >= 75 ? 'loss' : risk.riskScore >= 55 ? 'warn' : 'accent'}
            />
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted">Horizon</dt>
              <dd className="numeric text-right">{risk.horizonYears} years</dd>
              <dt className="text-muted">Liquidity need</dt>
              <dd className="text-right">{humanize(risk.liquidityNeed)}</dd>
              <dt className="text-muted">Assessed</dt>
              <dd className="text-right">{formatDate(risk.assessedAt)}</dd>
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">No risk assessment on file.</p>
        )}
      </section>
    </header>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading customer"
      className="grid gap-6 lg:grid-cols-[1fr_20rem]"
    >
      <div className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-11 w-72" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-16 w-full max-w-lg" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
    </div>
  );
}
