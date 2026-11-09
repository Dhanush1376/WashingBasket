import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom';

import { SkeletonRows } from '@/components/ui/States';
import { AdminLayout } from '@/layouts/AdminLayout';
import { isSignedIn } from '@/lib/demoAuth';
import { RootErrorPage } from '@/pages/RootErrorPage';

const OverviewPage = lazy(() => import('@/pages/overview/OverviewPage'));
const PickupsPage = lazy(() => import('@/pages/pickups/PickupsPage'));
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage'));
const CustomersPage = lazy(() => import('@/pages/customers/CustomersPage'));
const SupportPage = lazy(() => import('@/pages/support/SupportPage'));
const WalletPage = lazy(() => import('@/pages/wallet/WalletPage'));
const ReferralsPage = lazy(() => import('@/pages/referrals/ReferralsPage'));
const OffersPage = lazy(() => import('@/pages/offers/OffersPage'));
const ServicesPage = lazy(() => import('@/pages/services/ServicesPage'));
const SchedulePage = lazy(() => import('@/pages/schedule/SchedulePage'));
const LaundryLocationsPage = lazy(() => import('@/pages/laundry/LaundryLocationsPage'));
const LaundryStaffPage = lazy(() => import('@/pages/laundry/LaundryStaffPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const LoginPage = lazy(() => import('@/pages/login/LoginPage'));

/** The portal opens only after the demo sign-in; it returns to the page that was asked for. */
function RequireSignIn({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  if (isSignedIn()) return children;
  const next = pathname === '/' && !search ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return <Navigate to={`/login${next}`} replace />;
}

const page = (el: ReactNode) => (
  <Suspense
    fallback={
      <div className="page">
        <SkeletonRows rows={5} height={64} />
      </div>
    }
  >
    {el}
  </Suspense>
);

export const router = createBrowserRouter([
  { path: '/login', element: <Suspense fallback={null}><LoginPage /></Suspense>, errorElement: <RootErrorPage /> },
  {
    path: '/',
    element: (
      <RequireSignIn>
        <AdminLayout />
      </RequireSignIn>
    ),
    errorElement: <RootErrorPage />,
    children: [
      { index: true, element: page(<OverviewPage />) },
      { path: 'pickups', element: page(<PickupsPage />) },
      { path: 'orders', element: page(<OrdersPage />) },
      { path: 'customers', element: page(<CustomersPage />) },
      { path: 'support', element: page(<SupportPage />) },
      { path: 'wallet', element: page(<WalletPage />) },
      { path: 'referrals', element: page(<ReferralsPage />) },
      { path: 'offers', element: page(<OffersPage />) },
      { path: 'services', element: page(<ServicesPage />) },
      { path: 'schedule', element: page(<SchedulePage />) },
      { path: 'laundry', element: <Navigate to="/" replace /> },
      { path: 'laundry/orders', element: <Navigate to="/orders" replace /> },
      { path: 'laundry/locations', element: page(<LaundryLocationsPage />) },
      { path: 'laundry/staff', element: page(<LaundryStaffPage />) },
      { path: '*', element: page(<NotFoundPage />) },
    ],
  },
], {
  // the portal may be served from a sub-path (washingbasket.in/admin); Vite's `base` sets it at build time
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
});
