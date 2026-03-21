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
          {/* Fases 4+ adicionam rotas aqui */}
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
