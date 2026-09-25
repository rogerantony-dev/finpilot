import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded bg-line/70', className)} />;
}

/** Placeholder rows while a table loads. */
export function SkeletonRows({ rows = 8, columns }: { rows?: number; columns: number }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden>
      {Array.from({ length: columns }, (_, c) => (
        <td key={c} className="border-b border-line/70 px-4 py-3">
          <Skeleton className="h-3.5 w-full max-w-40" />
        </td>
      ))}
    </tr>
  ));
}
