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
import ClientPortalManagementPage from './app/(dashboard)/clientes/[id]/portal';
// Fase 5 — Tabelas de Preços
import PricingTablesPage from './app/(dashboard)/precos/index';
import PricingTableDetailPage from './app/(dashboard)/precos/[id]';
// Fase 6 — Trabalhos / OS
import JobListPage from './app/(dashboard)/trabalhos/index';
import JobCreatePage from './app/(dashboard)/trabalhos/novo';
import JobDetailPage from './app/(dashboard)/trabalhos/[id]';
// Fase 7 — Kanban
import KanbanPage from './app/(dashboard)/kanban';
// Fase 8 — Financeiro
import FinancialDashboard from './app/(dashboard)/financeiro/index';
import ContasReceberPage from './app/(dashboard)/financeiro/contas-receber';
import ContasPagarPage from './app/(dashboard)/financeiro/contas-pagar';
import FechamentoPage from './app/(dashboard)/financeiro/fechamento';
import LivroCaixaPage from './app/(dashboard)/financeiro/livro-caixa';
import FluxoCaixaPage from './app/(dashboard)/financeiro/fluxo-caixa';
// Fase 9 — Entregas
import DeliveryListPage from './app/(dashboard)/entregas/index';
import DeliveryDetailPage from './app/(dashboard)/entregas/[id]';
// Fase 10 — Estoque
import InventoryDashboard from './app/(dashboard)/estoque/index';
import MaterialsPage from './app/(dashboard)/estoque/materiais';
import SuppliersPage from './app/(dashboard)/estoque/fornecedores';
import PurchaseOrdersPage from './app/(dashboard)/estoque/ordens-compra';
import PODetailPage from './app/(dashboard)/estoque/oc/[id]';
// Fase 11 — Funcionários e Comissões
import EmployeeListPage from './app/(dashboard)/funcionarios/index';
import EmployeeCreatePage from './app/(dashboard)/funcionarios/novo';
import EmployeeEditPage from './app/(dashboard)/funcionarios/[id]';
import CommissionsPage from './app/(dashboard)/comissoes';
// Fase 12 — Folha de Pagamento
import PayrollListPage from './app/(dashboard)/payroll/index';
import PayrollDetailPage from './app/(dashboard)/payroll/[id]';
// Fase 13 - Scans 3D
import ScanListPage from './app/(dashboard)/scans/index';
import ScanUploadPage from './app/(dashboard)/scans/upload';
import ScanDetailPage from './app/(dashboard)/scans/[id]';
// Fase 14 - Agenda
import AgendaPage from './app/(dashboard)/agenda/index';
import EventCreatePage from './app/(dashboard)/agenda/novo';
import SettingsPage from './app/(dashboard)/configuracoes/index';
import SimulatorPage from './app/(dashboard)/simulador';
import FlowIAPage from './app/(dashboard)/flow-ia';
import IAAvancadaPage from './app/(dashboard)/ia-avancada';
import PlanosPage from './app/(dashboard)/planos';
import TicketsPage from './app/(dashboard)/suporte/tickets';
import ChatbotConfigPage from './app/(dashboard)/suporte/chatbot-config';
import ReportsHubPage from './app/(dashboard)/relatorios/index';
import PublicPortalPage from './app/portal/[token]';

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

        {/* Fase 17 - Portal publico por token */}
        <Route path="/portal/:token" element={<PublicPortalPage />} />

        {/* Onboarding — autenticado mas sem tenant */}
        <Route path="/onboarding" element={<OnboardingWizard />} />

        {/* Dashboard — autenticado + tenant obrigatório */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-500 text-sm">Dashboard (Phase 11+12 Implementation)</p>
            </div>
          } />
          {/* Fase 4 — Clientes */}
          <Route path="/clientes" element={<ClientListPage />} />
          <Route path="/clientes/novo" element={<ClientCreatePage />} />
          <Route path="/clientes/:id" element={<ClientEditPage />} />
          <Route path="/clientes/:id/portal" element={<ClientPortalManagementPage />} />
          {/* Fase 5 — Tabelas de Preços */}
          <Route path="/precos" element={<PricingTablesPage />} />
          <Route path="/precos/:id" element={<PricingTableDetailPage />} />
          {/* Fase 6 — Trabalhos / OS */}
          <Route path="/trabalhos" element={<JobListPage />} />
          <Route path="/trabalhos/novo" element={<JobCreatePage />} />
          <Route path="/trabalhos/:id" element={<JobDetailPage />} />
          {/* Fase 7 — Kanban */}
          <Route path="/kanban" element={<KanbanPage />} />
          {/* Fase 8 — Financeiro */}
          <Route path="/financeiro" element={<FinancialDashboard />} />
          <Route path="/financeiro/contas-receber" element={<ContasReceberPage />} />
          <Route path="/financeiro/contas-pagar" element={<ContasPagarPage />} />
          <Route path="/financeiro/fechamento" element={<FechamentoPage />} />
          <Route path="/financeiro/livro-caixa" element={<LivroCaixaPage />} />
          <Route path="/financeiro/fluxo-caixa" element={<FluxoCaixaPage />} />
          {/* Fase 9 — Entregas */}
          <Route path="/entregas" element={<DeliveryListPage />} />
          <Route path="/entregas/:id" element={<DeliveryDetailPage />} />
          {/* Fase 10 — Estoque */}
          <Route path="/estoque" element={<InventoryDashboard />} />
          <Route path="/estoque/materiais" element={<MaterialsPage />} />
          <Route path="/estoque/fornecedores" element={<SuppliersPage />} />
          <Route path="/estoque/ordens-compra" element={<PurchaseOrdersPage />} />
          <Route path="/estoque/oc/:id" element={<PODetailPage />} />
          {/* Fase 11 — Funcionários */}
          <Route path="/funcionarios" element={<EmployeeListPage />} />
          <Route path="/funcionarios/novo" element={<EmployeeCreatePage />} />
          <Route path="/funcionarios/:id" element={<EmployeeEditPage />} />
          <Route path="/comissoes" element={<CommissionsPage />} />
          {/* Fase 12 — Folha de Pagamento */}
          <Route path="/payroll" element={<PayrollListPage />} />
          <Route path="/payroll/:id" element={<PayrollDetailPage />} />
          {/* Fase 13 - Scans 3D */}
          <Route path="/scans" element={<ScanListPage />} />
          <Route path="/scans/upload" element={<ScanUploadPage />} />
          <Route path="/scans/:id" element={<ScanDetailPage />} />
          {/* Fase 14 - Agenda */}
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/agenda/novo" element={<EventCreatePage />} />
          {/* Fase 15 - Configuracoes */}
          <Route path="/simulador" element={<SimulatorPage />} />
          <Route path="/relatorios" element={<ReportsHubPage />} />
          <Route path="/planos" element={<PlanosPage />} />
          <Route path="/flow-ia" element={<FlowIAPage />} />
          <Route path="/ia-avancada" element={<IAAvancadaPage />} />
          <Route path="/suporte/tickets" element={<TicketsPage />} />
          <Route path="/suporte/chatbot-config" element={<ChatbotConfigPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
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
