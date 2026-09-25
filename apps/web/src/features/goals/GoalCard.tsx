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
        'flex flex-col gap-3 rounded-xl border bg-surface p-5',
        g.flags.overdue ? 'border-loss/40' : 'border-line',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
            {humanize(g.goalType)}
          </p>
          <h3 id={`goal-${g.goalId}`} className="mt-0.5 truncate font-display text-xl">
            {g.goalName}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={priorityTone[g.priority]}>{g.priority.toLowerCase()}</Badge>
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${g.goalName}`}>
              <Pencil size={14} aria-hidden />
            </Button>
          )}
        </div>
      </header>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="numeric font-display text-2xl">{pct.toFixed(1)}%</span>
          <span
            className="numeric text-sm text-muted"
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
        <span className={cn('text-muted', g.flags.overdue && 'font-medium text-loss')}>
          Target {formatDate(g.targetDate)}
        </span>
        <span className="ml-auto flex flex-wrap gap-1">
          <GoalFlags flags={g.flags} />
        </span>
      </footer>
    </article>
  );
}
