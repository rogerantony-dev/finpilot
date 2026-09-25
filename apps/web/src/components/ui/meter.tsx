import { Meter as BaseMeter } from '@base-ui/react/meter';
import { cn } from '../../lib/cn';

const tones = {
  accent: 'bg-accent',
  warn: 'bg-warn',
  loss: 'bg-loss',
  muted: 'bg-muted',
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
      <BaseMeter.Label className={cn('text-xs text-muted', hideLabel && 'sr-only')}>
        {label}
      </BaseMeter.Label>
      <BaseMeter.Track className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <BaseMeter.Indicator
          className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])}
        />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
}
