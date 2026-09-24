import { z } from 'zod';
import { decimalString, isoDate } from './common.js';

export const assetClass = z.enum(['EQUITY', 'ETF', 'MUTUAL_FUND', 'BOND', 'REIT', 'GSEC']);
export type AssetClass = z.infer<typeof assetClass>;
export const accountType = z.enum(['BROKERAGE', 'MUTUAL_FUND', 'RETIREMENT']);
export const accountStatus = z.enum(['ACTIVE', 'DORMANT', 'CLOSED']);

const valuation = {
  costBasis: decimalString,
  marketValue: decimalString,
  unrealisedPnl: decimalString,
};

export const position = z
  .object({
    accountId: z.string(),
    instrumentId: z.string(),
    symbol: z.string(),
    instrumentName: z.string(),
    assetClass,
    quantity: decimalString,
    avgCost: decimalString,
    lastPrice: decimalString,
    ...valuation,
  })
  .meta({ id: 'Position' });
export type Position = z.infer<typeof position>;

export const accountValuation = z
  .object({
    accountId: z.string(),
    accountType,
    provider: z.string(),
    status: accountStatus,
    openedAt: isoDate,
    baseCurrency: z.string(),
    positionCount: z.number().int(),
    ...valuation,
  })
  .meta({ id: 'AccountValuation' });
export type AccountValuation = z.infer<typeof accountValuation>;

export const allocationSlice = z
  .object({ assetClass, marketValue: decimalString, weightPct: decimalString })
  .meta({ id: 'AllocationSlice' });
export type AllocationSlice = z.infer<typeof allocationSlice>;

/** Real response for customer C0002 (positions truncated to two). Shown in the OpenAPI docs. */
export const portfolioExample = {
  customerId: 'C0002',
  currency: 'INR',
  snapshotDate: '2026-09-18',
  priceAsOf: '2026-09-18',
  totals: {
    accountCount: 1,
    positionCount: 8,
    costBasis: '235759.39',
    marketValue: '263088.49',
    unrealisedPnl: '27329.10',
  },
  accounts: [
    {
      accountId: 'A00002',
      accountType: 'BROKERAGE',
      provider: 'NorthStar Securities',
      status: 'ACTIVE',
      openedAt: '2024-12-27',
      baseCurrency: 'INR',
      positionCount: 8,
      costBasis: '235759.39',
      marketValue: '263088.49',
      unrealisedPnl: '27329.10',
    },
  ],
  allocation: [
    { assetClass: 'EQUITY', marketValue: '201193.28', weightPct: '76.47' },
    { assetClass: 'MUTUAL_FUND', marketValue: '57550.81', weightPct: '21.88' },
    { assetClass: 'BOND', marketValue: '4344.40', weightPct: '1.65' },
  ],
  positions: [
    {
      accountId: 'A00002',
      instrumentId: 'I0014',
      symbol: 'EQ014',
      instrumentName: 'FinPilot Equity 14',
      assetClass: 'EQUITY',
      quantity: '40.614000',
      avgCost: '2396.3600',
      lastPrice: '2341.6700',
      costBasis: '97325.77',
      marketValue: '95104.59',
      unrealisedPnl: '-2221.18',
    },
    {
      accountId: 'A00002',
      instrumentId: 'I0031',
      symbol: 'EQ031',
      instrumentName: 'FinPilot Equity 31',
      assetClass: 'EQUITY',
      quantity: '51.569000',
      avgCost: '1218.0400',
      lastPrice: '1577.7000',
      costBasis: '62813.10',
      marketValue: '81360.41',
      unrealisedPnl: '18547.31',
    },
  ],
} as const;

export const portfolio = z
  .object({
    customerId: z.string(),
    currency: z.string(),
    /** Holdings snapshot date and price date: how fresh the numbers are. Null if no holdings. */
    snapshotDate: isoDate.nullable(),
    priceAsOf: isoDate.nullable(),
    totals: z.object({
      accountCount: z.number().int(),
      positionCount: z.number().int(),
      ...valuation,
    }),
    accounts: z.array(accountValuation),
    allocation: z.array(allocationSlice),
    positions: z.array(position),
  })
  .meta({ id: 'Portfolio', examples: [portfolioExample] });
export type Portfolio = z.infer<typeof portfolio>;
