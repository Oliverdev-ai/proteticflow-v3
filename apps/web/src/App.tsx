import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { trpc, queryClient } from './lib/trpc';
import AuthLayout from './app/(auth)/layout';
import LoginPage from './app/(auth)/login';
import RegisterPage from './app/(auth)/register';
import ForgotPasswordPage from './app/(auth)/forgot-password';
import ResetPasswordPage from './app/(auth)/reset-password';
import { ProtectedRoute } from './components/auth/protected-route';
import './globals.css';

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
        <Route path="/" element={<ProtectedRoute><div>Dashboard (Fase 2)</div></ProtectedRoute>} />
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
