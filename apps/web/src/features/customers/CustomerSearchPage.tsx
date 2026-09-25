import { kycStatus, segment as segmentSchema } from '@finpilot/shared';
import { Search } from 'lucide-react';
import { Link } from 'react-router';
import {
  ActiveFilters,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  Select,
  SkeletonRows,
  SortableTh,
  Table,
  Td,
  Th,
  Tr,
} from '../../components/ui';
import { useUrlState } from '../../lib/use-url-state';
import { useCities, useCustomers } from './api';
import { KycBadge, SegmentBadge } from './badges';

const FILTERS = ['q', 'kycStatus', 'segment', 'city', 'sort', 'order'] as const;
const PAGE_SIZE = 20;

const kycOptions = [
  { value: '', label: 'All KYC statuses' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REVIEW', label: 'Review' },
];
const segmentOptions = [
  { value: '', label: 'All segments' },
  { value: 'HNI', label: 'HNI' },
  { value: 'Affluent', label: 'Affluent' },
  { value: 'Mass', label: 'Mass' },
];

type SortKey = 'customer_id' | 'full_name' | 'city';

export function CustomerSearchPage() {
  const { values, page, update } = useUrlState(FILTERS);
  const sort = (values.sort || 'customer_id') as SortKey;
  const order = values.order === 'desc' ? 'desc' : 'asc';

  const customers = useCustomers({
    q: values.q || undefined,
    // Unknown values in a hand-edited URL are ignored rather than sent to the API.
    kycStatus: kycStatus.safeParse(values.kycStatus).data,
    segment: segmentSchema.safeParse(values.segment).data,
    city: values.city || undefined,
    sort,
    order,
    page,
    pageSize: PAGE_SIZE,
  });
  const cities = useCities();

  // Each active filter becomes a removable pill; sort order is kept on clear.
  const labelOf = (options: { value: string; label: string }[], v: string) =>
    options.find((o) => o.value === v)?.label ?? v;
  const activeFilters = [
    values.q && { key: 'q', label: `Search: ${values.q}` },
    values.kycStatus && {
      key: 'kycStatus',
      label: `KYC: ${labelOf(kycOptions, values.kycStatus)}`,
    },
    values.segment && {
      key: 'segment',
      label: `Segment: ${labelOf(segmentOptions, values.segment)}`,
    },
    values.city && { key: 'city', label: `City: ${values.city}` },
  ].filter((f): f is { key: string; label: string } => Boolean(f));
  const clearFilters = () => update({ q: '', kycStatus: '', segment: '', city: '' });
  const toggleSort = (key: SortKey) =>
    update({ sort: key, order: sort === key && order === 'asc' ? 'desc' : 'asc' });

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ q: String(new FormData(event.currentTarget).get('q') ?? '').trim() });
  }

  return (
    <div className="">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">Search by name, customer ID, email or city.</p>
        </div>
      </header>

      <Card>
        <div className="border-b border-gray-alpha-100">
          <div className="flex flex-wrap items-end gap-3 p-4">
            <form
              role="search"
              onSubmit={handleSearch}
              className="flex min-w-64 flex-1 items-end gap-2"
            >
              {/* key resets the input when the URL changes (e.g. removing the search pill) */}
              <Field.Root className="flex-1" key={values.q}>
                <Field.Label>Search</Field.Label>
                <Field.Control
                  name="q"
                  type="search"
                  defaultValue={values.q}
                  placeholder="e.g. Rohan, C0012, Kochi"
                />
              </Field.Root>
              <Button type="submit" variant="secondary" aria-label="Search">
                <Search size={16} aria-hidden />
              </Button>
            </form>
            <Select
              label="KYC status"
              className="w-40"
              options={kycOptions}
              value={values.kycStatus}
              onValueChange={(v) => update({ kycStatus: v })}
            />
            <Select
              label="Segment"
              className="w-36"
              options={segmentOptions}
              value={values.segment}
              onValueChange={(v) => update({ segment: v })}
            />
            <Select
              label="City"
              className="w-36"
              options={[
                { value: '', label: 'All cities' },
                ...(cities.data ?? []).map((c) => ({ value: c, label: c })),
              ]}
              value={values.city}
              onValueChange={(v) => update({ city: v })}
            />
          </div>
          <ActiveFilters
            filters={activeFilters}
            onRemove={(key) => update({ [key]: '' })}
            onClearAll={clearFilters}
          />
        </div>

        {customers.isError ? (
          <ErrorState error={customers.error} onRetry={() => customers.refetch()} />
        ) : (
          <>
            <Table aria-busy={customers.isFetching}>
              <caption className="sr-only">
                Customers matching the current search and filters
              </caption>
              <thead>
                <tr>
                  <SortableTh
                    label="Customer"
                    active={sort === 'full_name'}
                    direction={order}
                    onSort={() => toggleSort('full_name')}
                  />
                  <SortableTh
                    label="ID"
                    active={sort === 'customer_id'}
                    direction={order}
                    onSort={() => toggleSort('customer_id')}
                  />
                  <Th className="hidden md:table-cell">Email</Th>
                  <SortableTh
                    label="City"
                    active={sort === 'city'}
                    direction={order}
                    onSort={() => toggleSort('city')}
                  />
                  <Th>KYC</Th>
                  <Th>Segment</Th>
                </tr>
              </thead>
              <tbody
                className={
                  customers.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined
                }
              >
                {customers.isPending ? (
                  <SkeletonRows columns={6} />
                ) : (
                  customers.data.data.map((c) => (
                    <Tr key={c.customerId}>
                      <Td>
                        <Link
                          to={`/customers/${c.customerId}`}
                          className="font-medium text-gray-900 decoration-gray-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-gray-400"
                        >
                          {c.fullName}
                        </Link>
                      </Td>
                      <Td className="font-mono text-xs text-gray-500">{c.customerId}</Td>
                      <Td className="hidden text-gray-500 md:table-cell">{c.email}</Td>
                      <Td>
                        {c.city} <span className="text-gray-500">· {c.state}</span>
                      </Td>
                      <Td>
                        <KycBadge status={c.kycStatus} />
                      </Td>
                      <Td>
                        <SegmentBadge segment={c.segment} />
                      </Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
            {customers.data && customers.data.page.totalItems === 0 && (
              <EmptyState title="No customers match">
                Try a shorter search or{' '}
                <button className="text-gray-900 underline" onClick={clearFilters}>
                  clear the filters
                </button>
                .
              </EmptyState>
            )}
            {customers.data && customers.data.page.totalItems > 0 && (
              <Pagination
                page={customers.data.page}
                onPageChange={(p) => update({ page: p })}
                itemLabel="customers"
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
