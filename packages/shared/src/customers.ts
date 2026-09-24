import { z } from 'zod';
import { isoDate, pageQuery, paginated } from './common.js';

export const kycStatus = z.enum(['VERIFIED', 'PENDING', 'REVIEW']);
export const segment = z.enum(['Mass', 'Affluent', 'HNI']);
export const riskLevel = z.enum(['Conservative', 'Moderate', 'Growth', 'Aggressive']);
export const level = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const customerIdParam = z.object({
  customerId: z.string().regex(/^C\d{4,}$/, { error: 'Customer ID looks like C0001' }),
});

export const customerListQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional().describe('Matches customer ID, name, email or city'),
  kycStatus: kycStatus.optional(),
  segment: segment.optional(),
  city: z.string().trim().max(100).optional(),
  sort: z.enum(['customer_id', 'full_name', 'city', 'onboarded_at']).default('customer_id'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type CustomerListQuery = z.infer<typeof customerListQuery>;

export const customerSummary = z
  .object({
    customerId: z.string(),
    fullName: z.string(),
    email: z.string(),
    city: z.string(),
    state: z.string(),
    kycStatus,
    segment,
  })
  .meta({ id: 'CustomerSummary' });
export type CustomerSummary = z.infer<typeof customerSummary>;

export const customerList = paginated(customerSummary);
export type CustomerList = z.infer<typeof customerList>;

export const riskProfile = z
  .object({
    riskScore: z.number().int(),
    riskLevel,
    assessedAt: isoDate,
    horizonYears: z.number().int(),
    liquidityNeed: level,
  })
  .meta({ id: 'RiskProfile' });
export type RiskProfile = z.infer<typeof riskProfile>;

export const customerDetail = customerSummary
  .extend({
    phone: z.string(),
    dateOfBirth: isoDate,
    onboardedAt: isoDate,
    /** Null when no assessment is on file. */
    riskProfile: riskProfile.nullable(),
  })
  .meta({ id: 'CustomerDetail' });
export type CustomerDetail = z.infer<typeof customerDetail>;

export const cityList = z.object({ data: z.array(z.string()) });
