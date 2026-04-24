import { ShieldAlert, Loader2, Settings2, ShieldCheck, Activity } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { usePermissions } from '../../../hooks/use-permissions';
import { useSettings } from '../../../hooks/use-settings';
import { SettingsTabs } from '../../../components/settings/settings-tabs';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';

export default function SettingsPage() {
  const location = useLocation();
  const { hasAccess, isLoading: permsLoading } = usePermissions();
  const { overview } = useSettings();
  const initialTabId = location.pathname === '/configuracoes/preferencias' ? 'preferencias' : undefined;

  if (permsLoading || overview.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        <div className="relative">
          <Loader2 className="animate-spin text-primary/30" size={64} strokeWidth={1.5} />
          <Settings2
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary"
            size={24}
          />
        </div>
        <Muted className="font-black uppercase tracking-[0.3em] animate-pulse">
          Sincronizando Preferências...
        </Muted>
      </div>
    );
  }

  if (!hasAccess('settings')) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        <div className="w-20 h-20 rounded-[32px] bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/10 shadow-inner">
          <ShieldAlert size={32} strokeWidth={2.5} />
        </div>
        <div className="text-center space-y-2">
          <Large className="text-destructive font-black tracking-tight text-xl">
            Acesso Restrito
          </Large>
          <Muted className="text-[10px] font-black uppercase tracking-[0.2em] max-w-xs mx-auto opacity-60">
            Você não possui níveis de privilégio suficientes para acessar o núcleo de configurações
            globais.
          </Muted>
        </div>
      </div>
    );
  }

  if (overview.error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        <div className="w-20 h-20 rounded-[32px] bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/10 shadow-inner">
          <Activity size={32} strokeWidth={2.5} />
        </div>
        <div className="text-center space-y-2">
          <Large className="text-destructive font-black tracking-tight">Falha na Comunicação</Large>
          <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
            Erro de sincronismo: {overview.error.message}
          </Muted>
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="flex flex-col gap-10 h-full overflow-auto p-4 md:p-1 max-w-7xl mx-auto pb-16">
      {/* Header Area */}
      <ScaleIn className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <H1 className="tracking-tighter">Configurações Gerais</H1>
            <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 leading-none">
              <ShieldCheck size={10} strokeWidth={3} /> Modo Root-Admin
            </div>
          </div>
          <Subtitle>
            Gerencie o motor operacional, identidade visual e regras de negócio do laboratório
          </Subtitle>
        </div>
      </ScaleIn>

      {/* Settings Grid Navigation & Content */}
      <ScaleIn delay={0.1}>
        <SettingsTabs {...(initialTabId ? { initialTabId } : {})} />
      </ScaleIn>

      <ScaleIn
        delay={0.2}
        className="bg-muted/30 border border-border/50 rounded-[32px] p-8 flex items-start gap-6 mt-4"
      >
        <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0 shadow-inner">
          <ShieldCheck size={24} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-black text-foreground uppercase tracking-tight leading-none">
            Protocolo de Integridade Síncrona
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed uppercase tracking-tight font-bold opacity-60">
            As definições efetuadas neste painel são propagadas em tempo real (Push-Sync) para todos
            os terminais ativos da organização, garantindo conformidade operacional imediata.
          </p>
        </div>
      </ScaleIn>
    </PageTransition>
  );
}
