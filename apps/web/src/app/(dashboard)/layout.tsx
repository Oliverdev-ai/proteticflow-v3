import { Outlet, Navigate } from 'react-router-dom';
import { useState } from 'react';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { Sidebar } from '../../components/layout/sidebar';
import { Header } from '../../components/layout/header';
import { LicenseBanner } from '../../components/licensing/license-banner';
import { useAuth } from '../../hooks/use-auth';

export function DashboardLayout() {
  const { isAuthenticated, isLoading, isFetching, isAuthResolved, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isAuthResolved && (isLoading || isFetching)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.activeTenantId) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleMobileSidebar={() => setMobileOpen(true)}
          onToggleSidebar={() => setCollapsed((v) => !v)}
        />
        <main className="flex-1 overflow-hidden">
          <SimpleBar className="h-full">
            <div className="p-4 md:p-6">
              <LicenseBanner />
              <Outlet />
            </div>
          </SimpleBar>
        </main>
      </div>
    </div>
  );
}
