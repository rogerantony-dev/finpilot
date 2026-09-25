import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** A quiet surface: white with a hairline ring, no heavy borders. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-xl bg-gray-0 ring-1 ring-gray-alpha-200', className)}
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
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex items-center justify-between gap-3 px-4 pt-3.5 pb-2', className)}>
      <h2 className="text-13 leading-[15px] font-medium text-gray-600">{title}</h2>
      {action}
    </header>
  );
}
