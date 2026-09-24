import type { InstrumentOption, Transaction, TransactionListQuery } from '@finpilot/shared';
import type { Db } from '../../db/index.js';

export async function listTransactions(db: Db, customerId: string, query: TransactionListQuery) {
  // Joining accounts on customer_id scopes every filter to this customer: an
  // accountId belonging to someone else simply matches nothing.
  let base = db
    .selectFrom('transactions as t')
    .innerJoin('accounts as a', (join) =>
      join.onRef('a.account_id', '=', 't.account_id').on('a.customer_id', '=', customerId),
    );

  if (query.from) base = base.where('t.trade_date', '>=', query.from);
  if (query.to) base = base.where('t.trade_date', '<=', query.to);
  if (query.accountId) base = base.where('t.account_id', '=', query.accountId);
  if (query.instrumentId) base = base.where('t.instrument_id', '=', query.instrumentId);
  if (query.type) base = base.where('t.transaction_type', '=', query.type);
  if (query.status) base = base.where('t.status', '=', query.status);

  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
    base
      .innerJoin('instruments as i', 'i.instrument_id', 't.instrument_id')
      .select([
        't.transaction_id',
        't.account_id',
        't.instrument_id',
        'i.symbol',
        'i.instrument_name',
        't.transaction_type',
        't.trade_date',
        't.quantity',
        't.price',
        't.amount',
        't.status',
      ])
      .orderBy(query.sort === 'amount' ? 't.amount' : 't.trade_date', query.order)
      .orderBy('t.transaction_id', query.order) // tie-breaker: stable pages
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .execute(),
  ]);

  const data = rows.map((r): Transaction => ({
    transactionId: r.transaction_id,
    accountId: r.account_id,
    instrumentId: r.instrument_id,
    symbol: r.symbol,
    instrumentName: r.instrument_name,
    transactionType: r.transaction_type as Transaction['transactionType'],
    tradeDate: r.trade_date,
    quantity: r.quantity,
    price: r.price,
    amount: r.amount,
    status: r.status as Transaction['status'],
  }));
  return { data, totalItems: Number(total) };
}

export async function listInstruments(db: Db): Promise<InstrumentOption[]> {
  const rows = await db
    .selectFrom('instruments')
    .select(['instrument_id', 'symbol', 'instrument_name'])
    .orderBy('instrument_id')
    .execute();
  return rows.map((r) => ({
    instrumentId: r.instrument_id,
    symbol: r.symbol,
    instrumentName: r.instrument_name,
  }));
}
