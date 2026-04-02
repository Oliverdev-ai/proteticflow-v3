import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../../components/layout/sidebar';
import { Header } from '../../components/layout/header';
import { LicenseBanner } from '../../components/licensing/license-banner';
import { useAuth } from '../../hooks/use-auth';

export function DashboardLayout() {
  const { isAuthenticated, isLoading, isFetching, isAuthResolved, user } = useAuth();

  if (isLoading || isFetching || !isAuthResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.activeTenantId) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-neutral-950 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <LicenseBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
