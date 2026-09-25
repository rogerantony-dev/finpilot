import type { Goal } from '@finpilot/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Button, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { useGoals } from './api';
import { GoalCard } from './GoalCard';
import { GoalDialog } from './GoalDialog';
import { hasFlags } from './GoalFlags';

export function GoalsPage() {
  const { customerId = '' } = useParams();
  const goals = useGoals(customerId);
  // null = closed, 'new' = create, Goal = edit that goal
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);

  const flagged = goals.data?.filter(hasFlags).length ?? 0;

  return (
    <section aria-labelledby="goals-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="goals-heading" className="font-display text-2xl">
            Financial goals
          </h2>
          {goals.data && (
            <p className="mt-0.5 text-sm text-muted">
              {goals.data.length} goal{goals.data.length === 1 ? '' : 's'}
              {flagged > 0 && ` · ${flagged} need attention`} · funded % = funded ÷ target
            </p>
          )}
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden /> New goal
        </Button>
      </div>

      {goals.isPending && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      )}
      {goals.isError && <ErrorState error={goals.error} onRetry={() => goals.refetch()} />}
      {goals.data?.length === 0 && (
        <EmptyState title="No goals yet">
          Create the customer's first goal to start tracking progress.
        </EmptyState>
      )}
      {goals.data && goals.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.data.map((g) => (
            <GoalCard key={g.goalId} goal={g} onEdit={() => setEditing(g)} />
          ))}
        </div>
      )}

      {/* key remounts the form for each goal, so default values are always fresh */}
      <GoalDialog
        key={editing === 'new' ? 'new' : (editing?.goalId ?? 'closed')}
        customerId={customerId}
        goal={editing && editing !== 'new' ? editing : undefined}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </section>
  );
}
