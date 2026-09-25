import type { Goal, GoalCreate, GoalUpdate } from '@finpilot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export const goalKeys = {
  list: (customerId: string) => ['customer', customerId, 'goals'] as const,
};

export function useGoals(customerId: string) {
  return useQuery({
    queryKey: goalKeys.list(customerId),
    queryFn: ({ signal }) => api<{ data: Goal[] }>(`/customers/${customerId}/goals`, { signal }),
    select: (r) => r.data,
  });
}

export function useSaveGoal(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, values }: { goalId?: string; values: GoalCreate | GoalUpdate }) =>
      goalId
        ? api<Goal>(`/goals/${goalId}`, { method: 'PATCH', body: values })
        : api<Goal>(`/customers/${customerId}/goals`, { method: 'POST', body: values }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalKeys.list(customerId) }),
  });
}
