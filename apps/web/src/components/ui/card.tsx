import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'rounded-xl border border-line bg-surface shadow-[0_1px_0_rgb(27_26_23/0.04)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-3 border-b border-line px-5 py-3.5',
        className,
      )}
    >
      <h2 className="text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h2>
      {action}
    </header>
  );
}
