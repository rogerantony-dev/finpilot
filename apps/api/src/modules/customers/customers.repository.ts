import type { CustomerDetail, CustomerListQuery, CustomerSummary } from '@finpilot/shared';
import { sql } from 'kysely';
import type { Db } from '../../db/index.js';
import { escapeLike } from '../../lib/sql.js';

type SummaryRow = {
  customer_id: string;
  full_name: string;
  email: string;
  city: string;
  state: string;
  kyc_status: string;
  segment: string;
};

const toSummary = (r: SummaryRow): CustomerSummary => ({
  customerId: r.customer_id,
  fullName: r.full_name,
  email: r.email,
  city: r.city,
  state: r.state,
  kycStatus: r.kyc_status as CustomerSummary['kycStatus'],
  segment: r.segment as CustomerSummary['segment'],
});

export async function listCustomers(db: Db, query: CustomerListQuery) {
  let base = db.selectFrom('customers');

  if (query.q) {
    const contains = `%${escapeLike(query.q)}%`;
    base = base.where((eb) =>
      eb.or([
        eb('customer_id', 'ilike', `${escapeLike(query.q!)}%`),
        eb('full_name', 'ilike', contains),
        eb('email', 'ilike', contains),
        eb('city', 'ilike', contains),
      ]),
    );
  }
  if (query.kycStatus) base = base.where('kyc_status', '=', query.kycStatus);
  if (query.segment) base = base.where('segment', '=', query.segment);
  if (query.city) base = base.where(sql<string>`lower(city)`, '=', query.city.toLowerCase());

  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
    base
      .select(['customer_id', 'full_name', 'email', 'city', 'state', 'kyc_status', 'segment'])
      .orderBy(query.sort, query.order)
      .orderBy('customer_id') // stable order across pages
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .execute(),
  ]);

  return { rows: rows.map(toSummary), totalItems: Number(total) };
}

export async function getCustomer(db: Db, customerId: string): Promise<CustomerDetail | null> {
  const row = await db
    .selectFrom('customers as c')
    .leftJoin('v_latest_risk_profile as r', 'r.customer_id', 'c.customer_id')
    .select([
      'c.customer_id',
      'c.full_name',
      'c.email',
      'c.phone',
      'c.city',
      'c.state',
      'c.date_of_birth',
      'c.onboarded_at',
      'c.kyc_status',
      'c.segment',
      'r.risk_score',
      'r.risk_level',
      'r.assessed_at',
      'r.horizon_years',
      'r.liquidity_need',
    ])
    .where('c.customer_id', '=', customerId)
    .executeTakeFirst();
  if (!row) return null;

  return {
    ...toSummary(row),
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    onboardedAt: row.onboarded_at,
    riskProfile:
      row.assessed_at === null
        ? null
        : {
            riskScore: row.risk_score!,
            riskLevel: row.risk_level as NonNullable<CustomerDetail['riskProfile']>['riskLevel'],
            assessedAt: row.assessed_at,
            horizonYears: row.horizon_years!,
            liquidityNeed: row.liquidity_need as NonNullable<
              CustomerDetail['riskProfile']
            >['liquidityNeed'],
          },
  };
}

export async function customerExists(db: Db, customerId: string): Promise<boolean> {
  const row = await db
    .selectFrom('customers')
    .select('customer_id')
    .where('customer_id', '=', customerId)
    .executeTakeFirst();
  return row !== undefined;
}

export async function listCities(db: Db): Promise<string[]> {
  const rows = await db.selectFrom('customers').select('city').distinct().orderBy('city').execute();
  return rows.map((r) => r.city);
}
