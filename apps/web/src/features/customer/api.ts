import type {
  CustomerDetail,
  InstrumentOption,
  Portfolio,
  TransactionList,
  TransactionListQuery,
} from '@finpilot/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

type TxParams = Partial<TransactionListQuery>;

export const customerDetailKeys = {
  detail: (id: string) => ['customer', id] as const,
  portfolio: (id: string) => ['customer', id, 'portfolio'] as const,
  transactions: (id: string, params: TxParams) => ['customer', id, 'transactions', params] as const,
  instruments: ['instruments'] as const,
};

export function useCustomer(customerId: string) {
  return useQuery({
    queryKey: customerDetailKeys.detail(customerId),
    queryFn: ({ signal }) => api<CustomerDetail>(`/customers/${customerId}`, { signal }),
  });
}

export function usePortfolio(customerId: string) {
  return useQuery({
    queryKey: customerDetailKeys.portfolio(customerId),
    queryFn: ({ signal }) => api<Portfolio>(`/customers/${customerId}/portfolio`, { signal }),
  });
}

export function useTransactions(customerId: string, params: TxParams, { enabled = true } = {}) {
  return useQuery({
    queryKey: customerDetailKeys.transactions(customerId, params),
    queryFn: ({ signal }) =>
      api<TransactionList>(`/customers/${customerId}/transactions`, { query: params, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useInstruments() {
  return useQuery({
    queryKey: customerDetailKeys.instruments,
    queryFn: ({ signal }) => api<{ data: InstrumentOption[] }>('/instruments', { signal }),
    staleTime: Infinity,
    select: (r) => r.data,
  });
}
