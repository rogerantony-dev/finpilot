import type { AllocationSlice } from '@finpilot/shared';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney, formatMoneyCompact, humanize } from '../../lib/format';
import { ASSET_COLORS } from './asset-colors';

/**
 * Donut chart plus a data table. The chart is decorative for screen readers;
 * the table (always visible, doubling as the legend) carries the same numbers.
 */
export function AllocationChart({ slices, total }: { slices: AllocationSlice[]; total: string }) {
  const data = slices.map((s) => ({
    name: humanize(s.assetClass),
    key: s.assetClass,
    value: Number(s.marketValue),
  }));

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[13rem_1fr]">
      <div className="relative h-52" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={ASSET_COLORS[d.key] ?? '#999'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatMoney(Number(value))}
              contentStyle={{ borderRadius: 8, border: '1px solid #e4ddcf', fontSize: 13 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] text-muted uppercase">Total</p>
            <p className="numeric font-display text-xl">{formatMoneyCompact(total)}</p>
          </div>
        </div>
      </div>

      <table className="w-full text-sm">
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
            <tr key={s.assetClass} className="border-b border-line/60 last:border-0">
              <th scope="row" className="py-2 text-left font-normal">
                <span
                  className="mr-2 inline-block size-2.5 rounded-sm align-middle"
                  style={{ background: ASSET_COLORS[s.assetClass] }}
                />
                {humanize(s.assetClass)}
              </th>
              <td className="numeric py-2 text-right text-muted">{formatMoney(s.marketValue)}</td>
              <td className="numeric w-20 py-2 text-right font-medium">
                {Number(s.weightPct).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
