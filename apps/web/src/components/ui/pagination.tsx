import type { PageInfo } from '@finpilot/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export function Pagination({
  page,
  onPageChange,
  itemLabel,
}: {
  page: PageInfo;
  onPageChange: (page: number) => void;
  itemLabel: string;
}) {
  const first = page.totalItems === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const last = Math.min(page.page * page.pageSize, page.totalItems);
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-13 tracking-[0.01em] text-gray-600"
    >
      <p aria-live="polite" className="tabular-nums">
        {first}–{last} of {page.totalItems.toLocaleString('en-IN')} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page.page <= 1}
          onClick={() => onPageChange(page.page - 1)}
        >
          <ChevronLeft size={14} aria-hidden /> Previous
        </Button>
        <span className="tabular-nums px-2 text-gray-500">
          {page.page} / {page.totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page.page >= page.totalPages}
          onClick={() => onPageChange(page.page + 1)}
        >
          Next <ChevronRight size={14} aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
