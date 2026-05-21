import { Outlet, Navigate } from 'react-router-dom';
import { useState } from 'react';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { Sidebar } from '../../components/layout/sidebar';
import { Header } from '../../components/layout/header';
import { UsageBanner } from '../../components/shared/usage-banner';
import { Breadcrumb } from '../../components/layout/breadcrumb';
import { FlowAssistantOverlay } from '../../components/ai/flow-assistant-overlay';
import { useAuth } from '../../hooks/use-auth';
import { trpc } from '../../lib/trpc';
import { useLocalStorage } from '../../hooks/use-local-storage';

export function DashboardLayout() {
  const { isAuthenticated, isAuthPending, isAuthResolved, user } = useAuth();
  const [fallbackCollapsed, setFallbackCollapsed] = useLocalStorage('ptf-sidebar-collapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: currentTenant, isLoading: isTenantLoading } = trpc.tenant.getCurrent.useQuery(
    undefined,
    { enabled: Boolean(user?.activeTenantId) },
  );
  const { data: userPreferences } = trpc.notification.getUserPreferences.useQuery(undefined, {
    enabled: Boolean(user?.activeTenantId),
    staleTime: 5 * 60 * 1000,
  });
  const updateUserPreferences = trpc.notification.updateUserPreferences.useMutation({
    onSuccess: (data) => {
      utils.notification.getUserPreferences.setData(undefined, data);
    },
  });

  const collapsed = userPreferences?.sidebarCollapsed ?? fallbackCollapsed;

  function setSidebarCollapsed(next: boolean) {
    setFallbackCollapsed(next);
    updateUserPreferences.mutate({ sidebarCollapsed: next });
  }

  if (!isAuthResolved && isAuthPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.activeTenantId) return <Navigate to="/onboarding" replace />;

  if (isTenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
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
        onToggleCollapse={() => setSidebarCollapsed(!collapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleMobileSidebar={() => setMobileOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed(!collapsed)}
        />
        <main className="flex-1 overflow-hidden">
          <SimpleBar className="h-full">
            <div className="p-4 md:p-6">
              <UsageBanner />
              <Breadcrumb />
              <Outlet />
            </div>
          </SimpleBar>
        </main>
      </div>
      <FlowAssistantOverlay />
    </div>
  );
}

