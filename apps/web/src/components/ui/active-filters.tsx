import { X } from 'lucide-react';

export interface ActiveFilter {
  key: string;
  /** What the pill says, e.g. "KYC: Pending". */
  label: string;
}

/**
 * Active filters as removable pills (Recollect's pill style), on their own
 * line below the filter controls, so choosing a filter never reflows them.
 * Renders nothing when no filter is active.
 */
export function ActiveFilters({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <div
      role="group"
      aria-label="Active filters"
      className="flex flex-wrap items-center gap-1.5 px-4 pb-3"
    >
      {filters.map((f) => (
        <span
          key={f.key}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-gray-alpha-100 pr-1 pl-3 text-13 leading-none font-medium tracking-[0.01em] text-gray-800"
        >
          {f.label}
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            aria-label={`Remove filter ${f.label}`}
            className="flex size-5 items-center justify-center rounded-full text-gray-500 outline-none hover:bg-gray-alpha-200 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-200"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      {filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="h-7 rounded-full px-2.5 text-13 leading-none font-medium tracking-[0.01em] text-gray-600 outline-none hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-200"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
