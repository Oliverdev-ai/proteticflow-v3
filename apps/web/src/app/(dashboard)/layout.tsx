import { Outlet, Navigate } from 'react-router-dom';
import { useState } from 'react';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { Sidebar } from '../../components/layout/sidebar';
import { Header } from '../../components/layout/header';
import { UsageBanner } from '../../components/shared/usage-banner';
import { FlowAssistantOverlay } from '../../components/ai/flow-assistant-overlay';
import { useAuth } from '../../hooks/use-auth';
import { trpc } from '../../lib/trpc';

export function DashboardLayout() {
  const { isAuthenticated, isAuthPending, isAuthResolved, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: currentTenant, isLoading: isTenantLoading } = trpc.tenant.getCurrent.useQuery(
    undefined,
    { enabled: Boolean(user?.activeTenantId) },
  );

  if (!isAuthResolved && isAuthPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.activeTenantId) return <Navigate to="/onboarding" replace />;

  if (isTenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (currentTenant && !currentTenant.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

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
              <UsageBanner />
              <Outlet />
            </div>
          </SimpleBar>
        </main>
      </div>
      <FlowAssistantOverlay />
    </div>
  );
}

