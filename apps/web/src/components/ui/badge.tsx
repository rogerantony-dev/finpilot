import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

// Soft tinted pills, sentence case (no uppercase tracking).
const tones = {
  neutral: 'bg-gray-100 text-gray-700',
  accent: 'bg-green-100 text-green-700',
  warn: 'bg-amber-100 text-amber-700',
  loss: 'bg-red-100 text-red-700',
  muted: 'bg-gray-alpha-100 text-gray-600',
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
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs leading-[115%] font-450 tracking-[0.01em] whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
