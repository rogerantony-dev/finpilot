import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '../../lib/cn';

// Semantic table primitives. Numeric columns are right-aligned with tabular figures.

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function Th({
  numeric,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line bg-paper/60 px-4 py-2.5 text-left text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-muted uppercase',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  numeric,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-line/70 px-4 py-2.5 align-middle',
        numeric && 'numeric text-right whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-paper/70', className)} {...props} />;
}

/** Column header that sorts; exposes aria-sort for assistive technology. */
export function SortableTh({
  label,
  active,
  direction,
  onSort,
  numeric,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
  numeric?: boolean;
}) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Th
      numeric={numeric}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'inline-flex items-center gap-1 uppercase hover:text-ink focus-visible:outline-2 focus-visible:outline-accent',
          active && 'text-ink',
        )}
      >
        {label}
        <Icon size={12} aria-hidden />
      </button>
    </Th>
  );
}
