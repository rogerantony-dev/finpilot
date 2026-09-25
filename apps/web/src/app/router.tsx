import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { NotFoundPage, RouteError } from '../components/layout/RouteError';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { CustomerSearchPage } from '../features/customers/CustomerSearchPage';

// Customer pages are code-split: the charting library and page code download
// only when a customer is opened, keeping the login and search screens light.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
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
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
