import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatPct,
  formatSignedMoney,
  humanize,
} from './format';

describe('format', () => {
  it('formats rupees with Indian digit grouping', () => {
    expect(formatMoney('1953574.61')).toBe('₹19,53,574.61');
    expect(formatMoney('0')).toBe('₹0.00');
  });

  it('abbreviates large amounts in lakh and crore', () => {
    expect(formatMoneyCompact('1953574.61')).toBe('₹19.54 L');
    expect(formatMoneyCompact('52754963.55')).toBe('₹5.28 Cr');
    expect(formatMoneyCompact('-250000')).toBe('−₹2.50 L');
  });

  it('signs gains and losses with a real minus sign', () => {
    expect(formatSignedMoney('27329.10')).toBe('+₹27,329.10');
    expect(formatSignedMoney('-2221.18')).toBe('−₹2,221.18');
    expect(formatPct('-0.55', { signed: true })).toBe('−0.55%');
  });

  it('formats calendar dates without a time-zone shift', () => {
    expect(formatDate('2026-09-18')).toBe('18 Sep 2026');
    expect(formatDate('2025-01-01')).toBe('1 Jan 2025');
  });

  it('humanizes codes and keeps acronyms', () => {
    expect(humanize('MUTUAL_FUND')).toBe('Mutual fund');
    expect(humanize('ETF')).toBe('ETF');
    expect(humanize('GSEC')).toBe('G-Sec');
  });
});
