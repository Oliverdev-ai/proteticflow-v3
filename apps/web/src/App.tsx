import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { Suspense, lazy, useState } from 'react';
import { trpc, queryClient } from './lib/trpc';
import { ThemeProvider } from './components/shared/theme-provider';
import AuthLayout from './app/(auth)/layout';
import LoginPage from './app/(auth)/login';
import RegisterPage from './app/(auth)/register';
import { DashboardLayout } from './app/(dashboard)/layout';
import PublicPortalPage from './app/portal/[token]';
import { PageSkeleton } from './components/shared/page-skeleton';

const ForgotPasswordPage = lazy(() => import('./app/(auth)/forgot-password'));
const ResetPasswordPage = lazy(() => import('./app/(auth)/reset-password'));
const LandingPage = lazy(() => import('./app/landing'));
const OnboardingWizard = lazy(() =>
  import('./app/(dashboard)/onboarding').then((module) => ({ default: module.OnboardingWizard }))
);
const ClientListPage = lazy(() => import('./app/(dashboard)/clientes/index'));
const ClientCreatePage = lazy(() => import('./app/(dashboard)/clientes/novo'));
const ClientEditPage = lazy(() => import('./app/(dashboard)/clientes/[id]'));
const ClientPortalManagementPage = lazy(() => import('./app/(dashboard)/clientes/[id]/portal'));
const PricingTablesPage = lazy(() => import('./app/(dashboard)/precos/index'));
const PricingTableDetailPage = lazy(() => import('./app/(dashboard)/precos/[id]'));
const JobListPage = lazy(() => import('./app/(dashboard)/trabalhos/index'));
const JobCreatePage = lazy(() => import('./app/(dashboard)/trabalhos/novo'));
const JobDetailPage = lazy(() => import('./app/(dashboard)/trabalhos/[id]'));
const KanbanPage = lazy(() => import('./app/(dashboard)/kanban'));
const KanbanTvPage = lazy(() => import('./app/(dashboard)/kanban-tv'));
const FinancialDashboard = lazy(() => import('./app/(dashboard)/financeiro/index'));
const ContasReceberPage = lazy(() => import('./app/(dashboard)/financeiro/contas-receber'));
const ContasPagarPage = lazy(() => import('./app/(dashboard)/financeiro/contas-pagar'));
const FechamentoPage = lazy(() => import('./app/(dashboard)/financeiro/fechamento'));
const LivroCaixaPage = lazy(() => import('./app/(dashboard)/financeiro/livro-caixa'));
const FluxoCaixaPage = lazy(() => import('./app/(dashboard)/financeiro/fluxo-caixa'));
const BoletosPage = lazy(() => import('./app/(dashboard)/fiscal/boletos'));
const NotasFiscaisPage = lazy(() => import('./app/(dashboard)/fiscal/notas-fiscais'));
const DeliveryListPage = lazy(() => import('./app/(dashboard)/entregas/index'));
const DeliveryDetailPage = lazy(() => import('./app/(dashboard)/entregas/[id]'));
const InventoryDashboard = lazy(() => import('./app/(dashboard)/estoque/index'));
const MaterialsPage = lazy(() => import('./app/(dashboard)/estoque/materiais'));
const SuppliersPage = lazy(() => import('./app/(dashboard)/estoque/fornecedores'));
const PurchaseOrdersPage = lazy(() => import('./app/(dashboard)/estoque/ordens-compra'));
const PODetailPage = lazy(() => import('./app/(dashboard)/estoque/oc/[id]'));
const PurchasesListPage = lazy(() => import('./app/(dashboard)/compras/index'));
const PurchaseFormPage = lazy(() => import('./app/(dashboard)/compras/novo'));
const PurchaseDetailPage = lazy(() => import('./app/(dashboard)/compras/[id]'));
const EmployeeListPage = lazy(() => import('./app/(dashboard)/funcionarios/index'));
const EmployeeCreatePage = lazy(() => import('./app/(dashboard)/funcionarios/novo'));
const EmployeeEditPage = lazy(() => import('./app/(dashboard)/funcionarios/[id]'));
const CommissionsPage = lazy(() => import('./app/(dashboard)/comissoes'));
const PayrollListPage = lazy(() => import('./app/(dashboard)/payroll/index'));
const PayrollDetailPage = lazy(() => import('./app/(dashboard)/payroll/[id]'));
const ScanListPage = lazy(() => import('./app/(dashboard)/scans/index'));
const ScanUploadPage = lazy(() => import('./app/(dashboard)/scans/upload'));
const ScanDetailPage = lazy(() => import('./app/(dashboard)/scans/[id]'));
const AgendaPage = lazy(() => import('./app/(dashboard)/agenda/index'));
const EventCreatePage = lazy(() => import('./app/(dashboard)/agenda/novo'));
const SettingsPage = lazy(() => import('./app/(dashboard)/configuracoes/index'));
const SimulatorPage = lazy(() => import('./app/(dashboard)/simulador'));
const ReportsHubPage = lazy(() => import('./app/(dashboard)/relatorios/index'));
const PlanosPage = lazy(() => import('./app/(dashboard)/planos'));
const FlowIAPage = lazy(() => import('./app/(dashboard)/flow-ia'));
const IAAvancadaPage = lazy(() => import('./app/(dashboard)/ia-avancada'));
const TicketsPage = lazy(() => import('./app/(dashboard)/suporte/tickets'));
const ChatbotConfigPage = lazy(() => import('./app/(dashboard)/suporte/chatbot-config'));
const AuditPage = lazy(() => import('./app/(dashboard)/auditoria/index'));
const DashboardPage = lazy(() => import('./app/(dashboard)/dashboard'));

import './globals.css';

function AppContent() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/landing" element={<LandingPage />} />

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route path="/portal/:token" element={<PublicPortalPage />} />
          <Route path="/onboarding" element={<OnboardingWizard />} />
          <Route path="/kanban-tv" element={<KanbanTvPage />} />

          <Route element={<DashboardLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clientes" element={<ClientListPage />} />
            <Route path="/clientes/novo" element={<ClientCreatePage />} />
            <Route path="/clientes/:id" element={<ClientEditPage />} />
            <Route path="/clientes/:id/portal" element={<ClientPortalManagementPage />} />

            <Route path="/precos" element={<PricingTablesPage />} />
            <Route path="/precos/:id" element={<PricingTableDetailPage />} />

            <Route path="/trabalhos" element={<JobListPage />} />
            <Route path="/trabalhos/novo" element={<JobCreatePage />} />
            <Route path="/trabalhos/:id" element={<JobDetailPage />} />

            <Route path="/kanban" element={<KanbanPage />} />

            <Route path="/financeiro" element={<FinancialDashboard />} />
            <Route path="/financeiro/contas-receber" element={<ContasReceberPage />} />
            <Route path="/financeiro/contas-pagar" element={<ContasPagarPage />} />
            <Route path="/financeiro/fechamento" element={<FechamentoPage />} />
            <Route path="/financeiro/livro-caixa" element={<LivroCaixaPage />} />
            <Route path="/financeiro/fluxo-caixa" element={<FluxoCaixaPage />} />
            <Route path="/fiscal/boletos" element={<BoletosPage />} />
            <Route path="/fiscal/notas-fiscais" element={<NotasFiscaisPage />} />

            <Route path="/entregas" element={<DeliveryListPage />} />
            <Route path="/entregas/:id" element={<DeliveryDetailPage />} />

            <Route path="/estoque" element={<InventoryDashboard />} />
            <Route path="/estoque/materiais" element={<MaterialsPage />} />
            <Route path="/estoque/fornecedores" element={<SuppliersPage />} />
            <Route path="/estoque/ordens-compra" element={<PurchaseOrdersPage />} />
            <Route path="/estoque/oc/:id" element={<PODetailPage />} />

            <Route path="/compras" element={<PurchasesListPage />} />
            <Route path="/compras/novo" element={<PurchaseFormPage />} />
            <Route path="/compras/:id" element={<PurchaseDetailPage />} />

            <Route path="/funcionarios" element={<EmployeeListPage />} />
            <Route path="/funcionarios/novo" element={<EmployeeCreatePage />} />
            <Route path="/funcionarios/:id" element={<EmployeeEditPage />} />
            <Route path="/comissoes" element={<CommissionsPage />} />

            <Route path="/payroll" element={<PayrollListPage />} />
            <Route path="/payroll/:id" element={<PayrollDetailPage />} />

            <Route path="/scans" element={<ScanListPage />} />
            <Route path="/scans/upload" element={<ScanUploadPage />} />
            <Route path="/scans/:id" element={<ScanDetailPage />} />

            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/agenda/novo" element={<EventCreatePage />} />

            <Route path="/simulador" element={<SimulatorPage />} />
            <Route path="/relatorios" element={<ReportsHubPage />} />
            <Route path="/planos" element={<PlanosPage />} />
            <Route path="/flow-ia" element={<FlowIAPage />} />
            <Route path="/ia-avancada" element={<IAAvancadaPage />} />
            <Route path="/suporte/tickets" element={<TicketsPage />} />
            <Route path="/suporte/chatbot-config" element={<ChatbotConfigPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/auditoria" element={<AuditPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default function App() {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/trpc' })],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
