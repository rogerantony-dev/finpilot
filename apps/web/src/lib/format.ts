// Display formatting. The API sends money and quantities as decimal strings;
// they are converted to numbers only here, for display.

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

/** ₹19,53,574.61 (Indian digit grouping). */
export const formatMoney = (value: string | number) => inr.format(Number(value));

/** ₹19.54 L / ₹1.95 Cr for headline figures; exact value belongs in a title/tooltip. */
export function formatMoneyCompact(value: string | number): string {
  const n = Number(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return (n < 0 ? '−' : '') + inrWhole.format(abs);
}

/** +₹1,234.00 / −₹56.10, with a real minus sign. */
export function formatSignedMoney(value: string | number): string {
  const n = Number(value);
  if (n === 0) return formatMoney(0);
  return `${n > 0 ? '+' : '−'}${inr.format(Math.abs(n))}`;
}

export const formatQuantity = (value: string | number) => plain.format(Number(value));

export function formatPct(value: string | number, { signed = false } = {}): string {
  const n = Number(value);
  const text = `${Math.abs(n).toFixed(2)}%`;
  if (!signed || n === 0) return n < 0 ? `−${text}` : text;
  return `${n > 0 ? '+' : '−'}${text}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * '2026-09-18' → '18 Sep 2026'. Built from the string itself: no Date object,
 * so no time-zone shift, and the same output in every browser (Intl month
 * abbreviations vary, e.g. 'Sept').
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m! - 1]} ${y}`;
}

// Codes that are acronyms or have a conventional spelling.
const SPECIAL: Record<string, string> = { ETF: 'ETF', REIT: 'REIT', GSEC: 'G-Sec', HNI: 'HNI' };

/** 'MUTUAL_FUND' → 'Mutual fund', 'ETF' → 'ETF'. */
export function humanize(value: string): string {
  if (SPECIAL[value]) return SPECIAL[value];
  const s = value.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Sign of a decimal string: 1, -1 or 0. */
export const signOf = (value: string | number) => Math.sign(Number(value));

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** ISO timestamp → '25 Sep, 15:21' in the viewer's time zone (for audit/history lists). */
export const formatDateTime = (iso: string) =>
  dateTimeFmt.format(new Date(iso)).replace('Sept', 'Sep');

/** 1536 → '1.5 KB'. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
