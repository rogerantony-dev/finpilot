import type { Goal } from '@finpilot/shared';
import { Pencil } from 'lucide-react';
import { Badge, Button, Meter } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDate, formatMoney, formatMoneyCompact, humanize } from '../../lib/format';
import { fundedTone, GoalFlags } from './GoalFlags';

const priorityTone = { HIGH: 'loss', MEDIUM: 'neutral', LOW: 'muted' } as const;

export function GoalCard({ goal: g, onEdit }: { goal: Goal; onEdit?: () => void }) {
  const pct = Number(g.fundedPct);
  return (
    <article
      aria-labelledby={`goal-${g.goalId}`}
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-gray-0 p-5',
        g.flags.overdue ? 'border-red-500/30' : 'border-gray-alpha-100',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-13 font-450 text-gray-500">{humanize(g.goalType)}</p>
          <h3
            id={`goal-${g.goalId}`}
            className="mt-0.5 truncate text-[15px] font-semibold tracking-[-0.01em]"
          >
            {g.goalName}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={priorityTone[g.priority]}>{humanize(g.priority)}</Badge>
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${g.goalName}`}>
              <Pencil size={14} aria-hidden />
            </Button>
          )}
        </div>
      </header>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="tabular-nums text-lg font-semibold tracking-[-0.01em]">
            {pct.toFixed(1)}%
          </span>
          <span
            className="tabular-nums text-sm text-gray-500"
            title={`${formatMoney(g.currentFundedAmount)} of ${formatMoney(g.targetAmount)}`}
          >
            {formatMoneyCompact(g.currentFundedAmount)} of {formatMoneyCompact(g.targetAmount)}
          </span>
        </div>
        <Meter
          value={pct}
          label={`${g.goalName} funding`}
          valueText={`${pct.toFixed(1)}% funded`}
          tone={fundedTone(g)}
        />
      </div>

      <footer className="flex flex-wrap items-center gap-2 text-sm">
        <span className={cn('text-gray-500', g.flags.overdue && 'font-medium text-loss')}>
          Target {formatDate(g.targetDate)}
        </span>
        <span className="ml-auto flex flex-wrap gap-1">
          <GoalFlags flags={g.flags} />
        </span>
      </footer>
    </article>
  );
}
