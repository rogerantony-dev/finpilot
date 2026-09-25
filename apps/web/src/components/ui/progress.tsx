import { Progress as BaseProgress } from '@base-ui/react/progress';

/** Progress bar; pass value={null} for an indeterminate (unknown duration) task. */
export function Progress({ value, label }: { value: number | null; label: string }) {
  return (
    <BaseProgress.Root value={value} className="flex flex-col gap-1.5">
      <BaseProgress.Label className="text-sm text-ink-soft">{label}</BaseProgress.Label>
      <BaseProgress.Track className="relative h-1.5 w-full overflow-hidden rounded-full bg-line">
        <BaseProgress.Indicator className="h-full rounded-full bg-accent transition-[width] duration-300 data-indeterminate:absolute data-indeterminate:w-1/3 data-indeterminate:animate-[indeterminate_1.1s_ease-in-out_infinite]" />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}
