// Recollect's palette: near-black for the dominant class, then distinct hues;
// each asset class keeps its colour everywhere (chart, legend, positions
// table). Full class names are written out so Tailwind generates them.
export const ASSET_CLASSES: Record<string, { dot: string; fill: string }> = {
  EQUITY: { dot: 'bg-gray-900', fill: 'fill-gray-900' },
  ETF: { dot: 'bg-blue-500', fill: 'fill-blue-500' },
  MUTUAL_FUND: { dot: 'bg-teal-500', fill: 'fill-teal-500' },
  BOND: { dot: 'bg-amber-500', fill: 'fill-amber-500' },
  REIT: { dot: 'bg-purple-500', fill: 'fill-purple-500' },
  GSEC: { dot: 'bg-gray-400', fill: 'fill-gray-400' },
};

const FALLBACK = { dot: 'bg-gray-500', fill: 'fill-gray-500' };
export const assetClassColor = (assetClass: string) => ASSET_CLASSES[assetClass] ?? FALLBACK;
