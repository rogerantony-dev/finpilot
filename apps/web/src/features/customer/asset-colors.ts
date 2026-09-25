// Earthy, distinguishable palette in the ledger style; each asset class keeps
// its colour everywhere (chart, legend, positions table). Kept separate from
// the chart so pages that only need colours don't load the chart library.
export const ASSET_COLORS: Record<string, string> = {
  EQUITY: '#0e5a47',
  ETF: '#5c9a82',
  MUTUAL_FUND: '#c39a52',
  BOND: '#8a5a3b',
  REIT: '#5f7896',
  GSEC: '#a9a192',
};
