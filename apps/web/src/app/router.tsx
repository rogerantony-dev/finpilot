import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { NotFoundPage, RouteError } from '../components/layout/RouteError';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { CustomerSearchPage } from '../features/customers/CustomerSearchPage';
import { Skeleton } from '../components/ui';

/** Shown while a lazily loaded page's code downloads on first visit. */
function PageLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

// Customer pages are code-split: the charting library and page code download
// only when a customer is opened, keeping the login and search screens light.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoading />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <CustomerSearchPage /> },
          {
            path: 'customers/:customerId',
            lazy: async () => ({
              Component: (await import('../features/customer/CustomerLayout')).CustomerLayout,
            }),
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('../features/customer/OverviewPage')).OverviewPage,
                }),
              },
              {
                path: 'positions',
                lazy: async () => ({
                  Component: (await import('../features/customer/PositionsPage')).PositionsPage,
                }),
              },
              {
                path: 'transactions',
                lazy: async () => ({
                  Component: (await import('../features/customer/TransactionsPage'))
                    .TransactionsPage,
                }),
              },
              {
                path: 'goals',
                lazy: async () => ({
                  Component: (await import('../features/goals/GoalsPage')).GoalsPage,
                }),
              },
            ],
          },
          {
            // Administrators only; everyone else is sent back to the customer list.
            element: <RequireAuth role="ADMIN" />,
            children: [
              {
                path: 'admin/import',
                lazy: async () => ({
                  Component: (await import('../features/admin/ImportPage')).ImportPage,
                }),
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
