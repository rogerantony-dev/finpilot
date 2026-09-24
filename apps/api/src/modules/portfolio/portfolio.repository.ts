import type { AccountValuation, AllocationSlice, Portfolio, Position } from '@finpilot/shared';
import type { Db } from '../../db/index.js';

// All valuation arithmetic happens in the database views (see the
// reporting_views migration). This module only selects and reshapes rows.
// View columns are typed nullable by the code generator; the underlying
// columns are NOT NULL, so the `!` assertions below are safe.

export async function getPortfolio(db: Db, customerId: string): Promise<Portfolio> {
  // Four independent queries, run in parallel: no per-account or per-position
  // round trips (no N+1), whatever the number of accounts.
  const [totals, accounts, allocation, positions] = await Promise.all([
    db
      .selectFrom('v_customer_portfolio')
      .selectAll()
      .where('customer_id', '=', customerId)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('v_account_valuation')
      .selectAll()
      .where('customer_id', '=', customerId)
      .orderBy('market_value', 'desc')
      .orderBy('account_id')
      .execute(),
    db
      .selectFrom('v_asset_allocation')
      .selectAll()
      .where('customer_id', '=', customerId)
      .orderBy('market_value', 'desc')
      .execute(),
    db
      .selectFrom('v_positions')
      .selectAll()
      .where('customer_id', '=', customerId)
      .orderBy('market_value', 'desc')
      .orderBy('instrument_id')
      .execute(),
  ]);

  return {
    customerId,
    currency: accounts[0]?.base_currency ?? 'INR',
    snapshotDate: totals.snapshot_date,
    priceAsOf: totals.price_as_of,
    totals: {
      accountCount: totals.account_count!,
      positionCount: totals.position_count!,
      costBasis: totals.cost_basis!,
      marketValue: totals.market_value!,
      unrealisedPnl: totals.unrealised_pnl!,
    },
    accounts: accounts.map((a): AccountValuation => ({
      accountId: a.account_id!,
      accountType: a.account_type as AccountValuation['accountType'],
      provider: a.provider!,
      status: a.status as AccountValuation['status'],
      openedAt: a.opened_at!,
      baseCurrency: a.base_currency!,
      positionCount: a.position_count!,
      costBasis: a.cost_basis!,
      marketValue: a.market_value!,
      unrealisedPnl: a.unrealised_pnl!,
    })),
    allocation: allocation.map((s): AllocationSlice => ({
      assetClass: s.asset_class as AllocationSlice['assetClass'],
      marketValue: s.market_value!,
      weightPct: s.weight_pct!,
    })),
    positions: positions.map((p): Position => ({
      accountId: p.account_id!,
      instrumentId: p.instrument_id!,
      symbol: p.symbol!,
      instrumentName: p.instrument_name!,
      assetClass: p.asset_class as Position['assetClass'],
      quantity: p.quantity!,
      avgCost: p.avg_cost!,
      lastPrice: p.last_price!,
      costBasis: p.cost_basis!,
      marketValue: p.market_value!,
      unrealisedPnl: p.unrealised_pnl!,
    })),
  };
}
