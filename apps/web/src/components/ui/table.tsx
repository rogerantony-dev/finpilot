import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/cn';

// Semantic table primitives: hairline rows, quiet headers, tabular figures for numbers.

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse text-13 leading-[115%] tracking-[0.01em] text-gray-800',
          className,
        )}
        {...props}
      />
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
        'border-b border-gray-alpha-100 px-4 py-2.5 text-left text-13 font-450 whitespace-nowrap text-gray-500',
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
        'border-b border-gray-alpha-50 px-4 py-2.5 align-middle',
        numeric && 'tabular-nums text-right whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-gray-alpha-50', className)} {...props} />;
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
  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Th
      numeric={numeric}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          '-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-200',
          active && 'text-gray-900',
        )}
      >
        {label}
        <Icon size={12} aria-hidden className={active ? undefined : 'opacity-50'} />
      </button>
    </Th>
  );
}
