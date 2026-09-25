import type { CustomerList, CustomerListQuery } from '@finpilot/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

type ListParams = Partial<CustomerListQuery>;

export const customerKeys = {
  list: (params: ListParams) => ['customers', 'list', params] as const,
  cities: ['customers', 'cities'] as const,
};

export function useCustomers(params: ListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => api<CustomerList>('/customers', { query: params, signal }),
    // Keep showing the current page while the next one loads: no flicker.
    placeholderData: keepPreviousData,
  });
}

export function useCities() {
  return useQuery({
    queryKey: customerKeys.cities,
    queryFn: ({ signal }) => api<{ data: string[] }>('/customers/cities', { signal }),
    staleTime: Infinity,
    select: (r) => r.data,
  });
}
