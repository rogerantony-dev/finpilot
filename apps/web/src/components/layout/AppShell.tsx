import { LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useLogout, useSession } from '../../features/auth/session';
import { cn } from '../../lib/cn';
import { Badge, Button } from '../ui';

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-ink/5',
    isActive ? 'font-medium text-ink' : 'text-muted',
  );

export function AppShell() {
  const { data: user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <NavLink to="/" className="font-display text-xl tracking-tight">
            Fin<span className="italic text-accent">Pilot</span>
          </NavLink>
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Customers
            </NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin/import" className={navClass}>
                Import
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-sm leading-tight font-medium">{user.fullName}</p>
                <Badge tone={user.role === 'ADMIN' ? 'accent' : 'muted'} className="mt-0.5">
                  {user.role}
                </Badge>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
              }
              disabled={logout.isPending}
            >
              <LogOut size={14} aria-hidden /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
