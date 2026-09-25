import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const tones = {
  neutral: 'border-line-strong bg-paper text-ink-soft',
  accent: 'border-accent/25 bg-accent-soft text-accent',
  warn: 'border-warn/25 bg-warn-soft text-warn',
  loss: 'border-loss/25 bg-loss-soft text-loss',
  muted: 'border-line bg-transparent text-muted',
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
