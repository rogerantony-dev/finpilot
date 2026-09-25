import { Progress as BaseProgress } from '@base-ui/react/progress';

/** Progress bar; pass value={null} for an indeterminate (unknown duration) task. */
export function Progress({ value, label }: { value: number | null; label: string }) {
  return (
    <BaseProgress.Root value={value} className="flex flex-col gap-1.5">
      <BaseProgress.Label className="text-13 font-450 tracking-[0.01em] text-gray-600">
        {label}
      </BaseProgress.Label>
      <BaseProgress.Track className="relative h-1 w-full overflow-hidden rounded-full bg-gray-alpha-200">
        <BaseProgress.Indicator className="h-full rounded-full bg-gray-900 transition-[width] duration-300 data-indeterminate:absolute data-indeterminate:w-1/3 data-indeterminate:animate-indeterminate motion-reduce:data-indeterminate:animate-none" />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}
