import type { Goal } from '@finpilot/shared';
import { Badge } from '../../components/ui';

/** Consistency flags computed by the database (v_goal_status). */
export function GoalFlags({ flags }: { flags: Goal['flags'] }) {
  return (
    <>
      {flags.overdue && <Badge tone="loss">Overdue</Badge>}
      {flags.highPriorityUnderfunded && <Badge tone="warn">High priority · under 25%</Badge>}
      {flags.overfunded && <Badge tone="accent">Over-funded</Badge>}
      {flags.nameTypeMismatch && (
        <Badge tone="muted" className="normal-case">
          <span title="The goal name mentions a different goal type">Name ≠ type</span>
        </Badge>
      )}
    </>
  );
}

export const hasFlags = (g: Goal) => Object.values(g.flags).some(Boolean);

export function fundedTone(g: Goal): 'accent' | 'warn' | 'loss' {
  if (g.flags.overdue) return 'loss';
  if (g.flags.highPriorityUnderfunded) return 'warn';
  return 'accent';
}
