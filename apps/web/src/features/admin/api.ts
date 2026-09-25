import type { ImportBatchList, ImportResult, RejectList } from '@finpilot/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export const importKeys = {
  batches: (page: number) => ['admin', 'imports', page] as const,
  rejects: (batchId: string, page: number) =>
    ['admin', 'imports', batchId, 'rejects', page] as const,
};

export function useImportTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, content }: { file: File; content: string }) =>
      api<ImportResult>('/admin/imports/transactions', {
        method: 'POST',
        query: { fileName: file.name },
        raw: { body: content, contentType: 'text/csv' },
      }),
    onSuccess: () => {
      // New batch in the history; imported transactions change customer ledgers.
      queryClient.invalidateQueries({ queryKey: ['admin', 'imports'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
    },
  });
}

export function useImportBatches(page: number) {
  return useQuery({
    queryKey: importKeys.batches(page),
    queryFn: ({ signal }) =>
      api<ImportBatchList>('/admin/imports', { query: { page, pageSize: 10 }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useBatchRejects(batchId: string, page: number) {
  return useQuery({
    queryKey: importKeys.rejects(batchId, page),
    queryFn: ({ signal }) =>
      api<RejectList>(`/admin/imports/${batchId}/rejects`, {
        query: { page, pageSize: 25 },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}
