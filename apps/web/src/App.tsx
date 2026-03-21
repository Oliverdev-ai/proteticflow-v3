import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { trpc, queryClient } from './lib/trpc';
import AuthLayout from './app/(auth)/layout';
import LoginPage from './app/(auth)/login';
import RegisterPage from './app/(auth)/register';
import ForgotPasswordPage from './app/(auth)/forgot-password';
import ResetPasswordPage from './app/(auth)/reset-password';
import { DashboardLayout } from './app/(dashboard)/layout';
import { OnboardingWizard } from './app/(dashboard)/onboarding';
// Fase 4 — Clientes
import ClientListPage from './app/(dashboard)/clientes/index';
import ClientCreatePage from './app/(dashboard)/clientes/novo';
import ClientEditPage from './app/(dashboard)/clientes/[id]';
// Fase 5 — Tabelas de Preços
import PricingTablesPage from './app/(dashboard)/precos/index';
import PricingTableDetailPage from './app/(dashboard)/precos/[id]';
// Fase 6 — Trabalhos / OS
import JobListPage from './app/(dashboard)/trabalhos/index';
import JobCreatePage from './app/(dashboard)/trabalhos/novo';
import JobDetailPage from './app/(dashboard)/trabalhos/[id]';
// Fase 7 — Kanban
import KanbanPage from './app/(dashboard)/kanban';
import './globals.css';

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Onboarding — autenticado mas sem tenant */}
        <Route path="/onboarding" element={<OnboardingWizard />} />

        {/* Dashboard — autenticado + tenant obrigatório */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-500 text-sm">Dashboard (Fase 26)</p>
            </div>
          } />
          {/* Fase 4 — Clientes */}
          <Route path="/clientes" element={<ClientListPage />} />
          <Route path="/clientes/novo" element={<ClientCreatePage />} />
          <Route path="/clientes/:id" element={<ClientEditPage />} />
          {/* Fase 5 — Tabelas de Preços */}
          <Route path="/precos" element={<PricingTablesPage />} />
          <Route path="/precos/:id" element={<PricingTableDetailPage />} />
          {/* Fase 6 — Trabalhos / OS */}
          <Route path="/trabalhos" element={<JobListPage />} />
          <Route path="/trabalhos/novo" element={<JobCreatePage />} />
          <Route path="/trabalhos/:id" element={<JobDetailPage />} />
          {/* Fase 7 — Kanban */}
          <Route path="/kanban" element={<KanbanPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/trpc' })],
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
