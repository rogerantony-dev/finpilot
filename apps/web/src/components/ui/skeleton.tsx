import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none', className)}
    />
  );
}

/** Placeholder rows while a table loads. */
export function SkeletonRows({ rows = 8, columns }: { rows?: number; columns: number }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden>
      {Array.from({ length: columns }, (_, c) => (
        <td key={c} className="border-b border-gray-alpha-50 px-4 py-3">
          <Skeleton className="h-3 w-full max-w-36" />
        </td>
      ))}
    </tr>
  ));
}
