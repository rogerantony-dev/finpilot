import type { Role } from '@finpilot/shared';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState, Skeleton } from '../../components/ui';
import { useSession } from './session';

/** Renders child routes for a signed-in user (optionally with a role); otherwise redirects. */
export function RequireAuth({ role }: { role?: Role }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return (
      <div className="mx-auto max-w-6xl p-8" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (session.isError)
    return <ErrorState error={session.error} onRetry={() => session.refetch()} />;
  if (!session.data) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (role && session.data.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
