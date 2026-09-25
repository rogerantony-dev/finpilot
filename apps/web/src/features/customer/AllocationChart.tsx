import type { AllocationSlice } from '@finpilot/shared';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';
import { cn } from '../../lib/cn';
import { formatMoney, formatMoneyCompact, humanize } from '../../lib/format';
import { assetClassColor } from './asset-colors';

type Datum = { name: string; key: string; value: number };

/** Tooltip styled with Tailwind (Recollect popup: white, rounded-xl, layered shadow). */
function SliceTooltip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as Datum | undefined;
  if (!active || !d) return null;
  return (
    <div className="rounded-xl bg-gray-0 px-2.5 py-1.5 text-13 leading-[115%] tracking-[0.01em] shadow-custom-3 ring-1 ring-black/5">
      <span className="font-450 text-gray-900">{d.name}</span>
      <span className="ml-2 tabular-nums text-gray-600">{formatMoney(d.value)}</span>
    </div>
  );
}

/**
 * Donut chart plus a data table. The chart is decorative for screen readers;
 * the table (always visible, doubling as the legend) carries the same numbers.
 */
export function AllocationChart({ slices, total }: { slices: AllocationSlice[]; total: string }) {
  const data: Datum[] = slices.map((s) => ({
    name: humanize(s.assetClass),
    key: s.assetClass,
    value: Number(s.marketValue),
  }));

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[13rem_1fr]">
      <div className="relative h-52" aria-hidden>
        {/* Chart layer above the centre label so the tooltip is never covered by it. */}
        <div className="relative z-10 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="74%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.key} className={assetClassColor(d.key).fill} />
                ))}
              </Pie>
              <Tooltip content={SliceTooltip} cursor={false} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-[15px] font-semibold tracking-[-0.01em] tabular-nums">
              {formatMoneyCompact(total)}
            </p>
          </div>
        </div>
      </div>

      <table className="w-full text-13 tracking-[0.01em]">
        <caption className="sr-only">Asset allocation by market value</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Asset class</th>
            <th scope="col">Market value</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((s) => (
            <tr key={s.assetClass} className="border-b border-gray-alpha-50 last:border-0">
              <th scope="row" className="py-2 text-left font-450 text-gray-800">
                <span
                  className={cn(
                    'mr-2 inline-block size-2 rounded-full align-middle',
                    assetClassColor(s.assetClass).dot,
                  )}
                />
                {humanize(s.assetClass)}
              </th>
              <td className="py-2 text-right text-gray-500 tabular-nums">
                {formatMoney(s.marketValue)}
              </td>
              <td className="w-16 py-2 text-right font-medium text-gray-900 tabular-nums">
                {Number(s.weightPct).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
