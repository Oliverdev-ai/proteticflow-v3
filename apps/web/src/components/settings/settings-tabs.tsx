import { useState } from 'react';
import {
  User, Building2, Users, ShieldCheck,
  CreditCard, Bell, Receipt, ChevronLeft,
  ChevronRight, Settings2, Activity, Mic,
} from 'lucide-react';
import { ProfileForm } from './profile-form';
import { LabTab } from './lab-tab';
import { EmployeesTab } from './employees-tab';
import { AuthorizationsTab } from './authorizations-tab';
import { PlansTab } from './plans-tab';
import { NotificationsTab } from './notifications-tab';
import { FlowAiTab } from './flow-ai-tab';
import { FiscalSettingsForm } from '../fiscal/fiscal-settings-form';
import { cn } from '../../lib/utils';
import { PageTransition } from '../shared/page-transition';

type TabItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  component: React.ReactNode;
  roles?: string[];
};

const SETTINGS_TABS: TabItem[] = [
  { id: 'perfil', label: 'Meu Perfil', icon: User, component: <ProfileForm /> },
  { id: 'laboratorio', label: 'Laboratório', icon: Building2, component: <LabTab />, roles: ['superadmin', 'gerente'] },
  { id: 'equipe', label: 'Time & Elenco', icon: Users, component: <EmployeesTab />, roles: ['superadmin', 'gerente'] },
  { id: 'autorizacoes', label: 'Privilégios', icon: ShieldCheck, component: <AuthorizationsTab />, roles: ['superadmin'] },
  { id: 'plano', label: 'Assinatura', icon: CreditCard, component: <PlansTab />, roles: ['superadmin'] },
  { id: 'notificacoes', label: 'Notificações', icon: Bell, component: <NotificationsTab /> },
  { id: 'flow-ia', label: 'Flow IA', icon: Mic, component: <FlowAiTab /> },
  { id: 'fiscal', label: 'Fiscal & Gateway', icon: Receipt, component: <FiscalSettingsForm />, roles: ['superadmin'] },
];

export function SettingsTabs() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(SETTINGS_TABS[0]?.id ?? 'perfil');

  const selectedTab = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0];
  if (!selectedTab) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[700px] w-full">
      <div
        className={cn(
          'flex flex-col gap-2 transition-all duration-500 ease-in-out relative shrink-0',
          collapsed ? 'w-20' : 'w-full lg:w-72',
        )}
      >
        <div className="bg-card/30 backdrop-blur-md border border-border/50 rounded-[32px] p-3 flex flex-col gap-1 shadow-2xl shadow-black/10 overflow-hidden sticky top-24">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full h-10 rounded-2xl hover:bg-muted/50 text-muted-foreground transition-all mb-4 group"
          >
            {collapsed ? (
              <ChevronRight size={18} />
            ) : (
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest">
                <ChevronLeft size={14} /> Recolher Painel
              </div>
            )}
          </button>

          <div className="flex flex-col gap-1.5">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 relative group overflow-hidden outline-none',
                  'text-[10px] font-black uppercase tracking-[0.15em]',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02] z-10'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <div
                  className={cn(
                    'shrink-0 transition-transform duration-500 group-hover:scale-110',
                    activeTab === tab.id ? 'text-primary-foreground' : 'text-primary/60',
                  )}
                >
                  <tab.icon size={18} strokeWidth={activeTab === tab.id ? 3 : 2} />
                </div>
                {!collapsed && <span className="truncate animate-in fade-in slide-in-from-left-2 duration-500">{tab.label}</span>}
                {activeTab === tab.id && !collapsed && (
                  <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-primary-foreground/40 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {!collapsed && (
            <div className="mt-8 p-6 bg-muted/20 border-t border-border/30 flex flex-col gap-4 animate-in fade-in duration-1000">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                  <Activity size={14} strokeWidth={3} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Cluster Status</span>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Ativo</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shadow-inner">
                  <Settings2 size={14} strokeWidth={3} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Versão</span>
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">3.0.0-rc</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <PageTransition key={selectedTab.id}>
          <div className="flex flex-col gap-2 mb-10 ml-4 lg:ml-0">
            <h2 className="text-3xl font-black text-foreground uppercase tracking-tight overflow-hidden leading-tight">
              {selectedTab.label}
            </h2>
            <div className="flex items-center gap-4">
              <div className="h-1 w-12 bg-primary rounded-full shadow-glow-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 italic">
                Módulo de Configuração de Malha
              </span>
            </div>
          </div>
          {selectedTab.component}
        </PageTransition>
      </div>
    </div>
  );
}
