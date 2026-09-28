import { LogOut, Upload, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useLogout, useSession } from '../../features/auth/session';
import { cn } from '../../lib/cn';

// Layout follows Recollect's dashboard: a quiet left side pane with a hairline
// border, 14px/450 nav items that fill gray-100 on hover and when current.
const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex h-8 items-center gap-2 rounded-lg px-2 text-[14px] leading-[115%] font-450 tracking-[0.01em] outline-hidden transition-colors',
    'hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-inset',
    isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-800',
  );

function NavItem({
  to,
  end,
  icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className={navItemClass}>
      <span className="flex size-4.5 items-center justify-center text-gray-700">{icon}</span>
      {children}
    </NavLink>
  );
}

export function AppShell() {
  const { data: user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const signOut = () =>
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  const initials = user?.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-gray-0 focus:px-3 focus:py-2 focus:shadow-custom-3"
      >
        Skip to content
      </a>

      <aside className="flex shrink-0 flex-col border-b border-gray-alpha-100 bg-gray-0 lg:sticky lg:top-0 lg:h-dvh lg:w-61.5 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-md bg-gray-950 text-[11px] font-semibold text-gray-0"
          >
            F
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-gray-900">
            FinPilot
          </span>
        </div>

        <nav
          aria-label="Main"
          className="flex gap-0.5 overflow-x-auto p-2 pt-0 lg:flex-1 lg:flex-col"
        >
          <NavItem to="/" end icon={<Users size={16} />}>
            Customers
          </NavItem>
          {user?.role === 'ADMIN' && (
            <NavItem to="/admin/import" icon={<Upload size={16} />}>
              Import
            </NavItem>
          )}
        </nav>

        {user && (
          <div className="hidden items-center gap-2 border-t border-gray-alpha-100 p-2 lg:flex">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-medium text-gray-700"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-13 leading-[115%] font-450 text-gray-900">
                {user.fullName}
              </p>
              <p className="text-[11px] leading-3 font-450 text-gray-500">
                {user.role === 'ADMIN' ? 'Admin' : 'Viewer'}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={logout.isPending}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-1.5 text-gray-500 outline-none hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-200"
            >
              <LogOut size={15} aria-hidden />
            </button>
          </div>
        )}
        {/* Narrow screens: sign-out sits with the nav. */}
        <div className="flex justify-end px-2 pb-2 lg:hidden">
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg px-2 py-1 text-13 text-gray-600 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto max-w-280 px-5 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
