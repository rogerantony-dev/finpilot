import { Meter as BaseMeter } from '@base-ui/react/meter';
import { cn } from '../../lib/cn';

const tones = {
  accent: 'bg-gray-900',
  warn: 'bg-amber-500',
  loss: 'bg-red-500',
  muted: 'bg-gray-400',
} as const;

export interface MeterProps {
  /** 0–100; values above 100 fill the bar. */
  value: number;
  label: string;
  hideLabel?: boolean;
  /** Screen-reader text, e.g. "82% funded". */
  valueText?: string;
  tone?: keyof typeof tones;
  className?: string;
}

/** A measured quantity within a range (funded %, risk score). Announced to screen readers. */
export function Meter({
  value,
  label,
  hideLabel = true,
  valueText,
  tone = 'accent',
  className,
}: MeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <BaseMeter.Root
      value={clamped}
      aria-valuetext={valueText}
      className={cn('flex flex-col gap-1', className)}
    >
      <BaseMeter.Label className={cn('text-xs text-gray-600', hideLabel && 'sr-only')}>
        {label}
      </BaseMeter.Label>
      <BaseMeter.Track className="h-1 w-full overflow-hidden rounded-full bg-gray-alpha-200">
        <BaseMeter.Indicator
          className={cn(
            'h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none',
            tones[tone],
          )}
        />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
}
