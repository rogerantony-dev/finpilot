import { goalCreate, type Goal, type GoalUpdate } from '@finpilot/shared';
import { useState } from 'react';
import {
  Button,
  Dialog,
  Field,
  Form,
  type FormErrors,
  Select,
  useToast,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { issuesToErrors } from '../../lib/form-errors';
import { useSaveGoal } from './api';
import { goalTypeOptions, priorityOptions } from './options';

const EDITABLE = [
  'goalType',
  'goalName',
  'targetAmount',
  'currentFundedAmount',
  'targetDate',
  'priority',
] as const;

export interface GoalDialogProps {
  customerId: string;
  /** The goal to edit; omit to create a new one. */
  goal?: Goal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Create/edit form. Validates with the same Zod schema the API uses (no native
 * `required` attributes, so every problem is reported at once, in our wording), so most
 * mistakes are caught before a request; the server's field errors (400/422)
 * are shown under the matching field.
 */
export function GoalDialog({ customerId, goal, open, onOpenChange }: GoalDialogProps) {
  const save = useSaveGoal(customerId);
  const toast = useToast();
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function close(next: boolean) {
    if (!next) {
      setErrors({});
      setFormError(null);
    }
    onOpenChange(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = goalCreate.safeParse(raw);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }
    setErrors({});

    // When editing, send only what changed (PATCH semantics).
    const values = goal
      ? (Object.fromEntries(
          EDITABLE.filter((k) => !sameValue(parsed.data[k], goal[k])).map((k) => [
            k,
            parsed.data[k],
          ]),
        ) as GoalUpdate)
      : parsed.data;
    if (goal && Object.keys(values).length === 0) return close(false);

    save.mutate(
      { goalId: goal?.goalId, values },
      {
        onSuccess: (saved) => {
          toast.add({
            title: goal ? 'Goal updated' : 'Goal created',
            description: `${saved.goalName} · ${saved.goalId}`,
          });
          close(false);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.details.some((d) => d.field)) {
            setErrors(
              Object.fromEntries(
                err.details.filter((d) => d.field).map((d) => [d.field!, d.message]),
              ),
            );
          } else {
            setFormError(err.message);
          }
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={goal ? 'Edit goal' : 'New goal'}
      description={
        goal
          ? `${goal.goalId} · ${goal.goalName}`
          : 'Amounts in INR. The target date must be today or later.'
      }
    >
      <Form errors={errors} onSubmit={handleSubmit} noValidate>
        <Field.Root name="goalName">
          <Field.Label>Goal name</Field.Label>
          <Field.Control
            defaultValue={goal?.goalName}
            maxLength={100}
            aria-required
            placeholder="e.g. Daughter's university"
          />
          <Field.Error />
        </Field.Root>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field.Root name="goalType">
            <Select
              label="Type"
              name="goalType"
              options={goalTypeOptions}
              defaultValue={goal?.goalType ?? 'RETIREMENT'}
            />
            <Field.Error />
          </Field.Root>
          <Field.Root name="priority">
            <Select
              label="Priority"
              name="priority"
              options={priorityOptions}
              defaultValue={goal?.priority ?? 'MEDIUM'}
            />
            <Field.Error />
          </Field.Root>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field.Root name="targetAmount">
            <Field.Label>Target amount (₹)</Field.Label>
            <Field.Control
              inputMode="decimal"
              defaultValue={goal ? trimZeros(goal.targetAmount) : ''}
              aria-required
              placeholder="2500000"
            />
            <Field.Error />
          </Field.Root>
          <Field.Root name="currentFundedAmount">
            <Field.Label>Funded so far (₹)</Field.Label>
            <Field.Control
              inputMode="decimal"
              defaultValue={goal ? trimZeros(goal.currentFundedAmount) : '0'}
            />
            <Field.Error />
          </Field.Root>
        </div>

        <Field.Root name="targetDate">
          <Field.Label>Target date</Field.Label>
          <Field.Control type="date" defaultValue={goal?.targetDate} aria-required />
          <Field.Error />
        </Field.Root>

        {formError && (
          <p
            role="alert"
            className="rounded-md border border-red-500/20 bg-red-100 px-3 py-2 text-sm text-loss"
          >
            {formError}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : goal ? 'Save changes' : 'Create goal'}
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}

/** '5000000.00' → '5000000' for friendlier editing. */
const trimZeros = (v: string) => v.replace(/\.00$/, '');

/** Compare form value with stored value, treating 5000000 and 5000000.00 as equal. */
const sameValue = (a: string, b: string) =>
  /^\d+(\.\d+)?$/.test(a) && /^\d+(\.\d+)?$/.test(b) ? Number(a) === Number(b) : a === b;
