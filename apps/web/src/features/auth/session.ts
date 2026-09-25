import type { LoginRequest, SessionUser } from '@finpilot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';

export const SESSION_KEY = ['session'] as const;

/** The signed-in user, or null. Loaded once from /auth/me; kept fresh by login/logout. */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async (): Promise<SessionUser | null> => {
      try {
        return (await api<{ user: SessionUser }>('/auth/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      api<{ user: SessionUser }>('/auth/login', { method: 'POST', body: credentials }),
    onSuccess: ({ user }) => queryClient.setQueryData(SESSION_KEY, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      // Mark the session signed out (observers of the session query re-render),
      // then drop every cached customer record so nothing lingers in memory.
      queryClient.setQueryData(SESSION_KEY, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] });
    },
  });
}
