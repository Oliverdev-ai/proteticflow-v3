import { useMemo } from 'react';
import { 
  BellRing, Mail, Smartphone, 
  Send, Loader2, CheckCircle2,
  Activity, Info
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { NOTIFICATION_EVENT_LABELS } from '@proteticflow/shared';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

function base64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64Safe);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function NotificationsTab() {
  const utils = trpc.useUtils();
  const preferencesQuery = trpc.notification.listPreferences.useQuery();
  const vapidQuery = trpc.notification.vapidPublicKey.useQuery();
  const testDispatchMutation = trpc.notification.testDispatch.useMutation();

  const updatePreferenceMutation = trpc.notification.upsertPreference.useMutation({
    onSuccess: async () => {
      await utils.notification.listPreferences.invalidate();
    },
  });

  const saveSubscriptionMutation = trpc.notification.savePushSubscription.useMutation();

  const preferences = useMemo(() => preferencesQuery.data ?? [], [preferencesQuery.data]);

  async function handlePushSubscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Seu navegador não suporta a tecnologia de notificações PWA.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('A permissão de notificação foi negada pelo usuário.');
      return;
    }

    const vapidKey = vapidQuery.data?.key;
    if (!vapidKey) {
      alert('Motor de VAPID não configurado no servidor.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        alert('Falha na extração dos metadados de inscrição PWA.');
        return;
      }

      await saveSubscriptionMutation.mutateAsync({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      });

      alert('Notificações nativas habilitadas com sucesso.');
    } catch (e) {
      console.error(e);
      alert('Erro crítico ao registrar Service Worker para Push.');
    }
  }

  const Switch = ({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <label className={cn("relative inline-flex items-center cursor-pointer group", disabled && "opacity-30 cursor-not-allowed grayscale")}>
      <input 
        type="checkbox" 
        className="sr-only peer" 
        checked={checked} 
        onChange={e => !disabled && onChange(e.target.checked)} 
        disabled={disabled}
      />
      <div className="w-11 h-6 bg-muted rounded-full border border-border peer-checked:bg-primary/20 peer-checked:border-primary/40 transition-all duration-300 shadow-inner group-hover:border-primary/20" />
      <div className="absolute left-1 top-1 w-4 h-4 bg-muted-foreground rounded-full transition-all duration-300 peer-checked:left-6 peer-checked:bg-primary shadow-sm" />
    </label>
  );

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Table Section */}
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] overflow-hidden group/notif shadow-xl shadow-black/5">
        <div className="p-8 border-b border-border/50 bg-card/30 flex flex-wrap items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                 <BellRing size={20} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5">
                 <Large className="tracking-tight text-lg font-black uppercase">Matriz de Conectividade</Large>
                 <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Configure os canais de recebimento por gatilho operacional</Muted>
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <button 
                onClick={handlePushSubscribe}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95"
              >
                 <Smartphone size={14} strokeWidth={3} /> Ativar Push (PWA)
              </button>
              <button 
                onClick={() => testDispatchMutation.mutate({ message: 'Auditória de conectividade V3' })}
                disabled={testDispatchMutation.isPending}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-muted border border-border text-foreground hover:bg-muted/80 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                 {testDispatchMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={3} />}
                 Disparo de Teste
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">Evento Operacional</th>
                <th className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-6 flex items-center justify-center gap-2">
                   <Activity size={12} className="text-primary/40" /> In-App
                </th>
                <th className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-6">
                   <div className="flex items-center justify-center gap-2">
                      <Smartphone size={12} className="text-primary/40" /> Push Native
                   </div>
                </th>
                <th className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-6">
                   <div className="flex items-center justify-center gap-2">
                      <Mail size={12} className="text-primary/40" /> E-mail
                   </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {preferences.map((pref) => (
                <tr key={pref.eventKey} className="group/row hover:bg-primary/[0.01] transition-all duration-300">
                  <td className="px-10 py-6">
                     <div className="flex items-center gap-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/20 group-hover/row:bg-primary transition-colors" />
                        <span className="text-sm font-black text-foreground tracking-tight group-hover/row:text-primary transition-colors">
                           {NOTIFICATION_EVENT_LABELS[pref.eventKey] || pref.eventKey}
                        </span>
                     </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <Switch 
                      checked={pref.inAppEnabled} 
                      onChange={(checked) => updatePreferenceMutation.mutate({ ...pref, inAppEnabled: checked })}
                      disabled={updatePreferenceMutation.isPending}
                    />
                  </td>
                  <td className="px-8 py-6 text-center">
                    <Switch 
                      checked={pref.pushEnabled} 
                      onChange={(checked) => updatePreferenceMutation.mutate({ ...pref, pushEnabled: checked })}
                      disabled={updatePreferenceMutation.isPending}
                    />
                  </td>
                  <td className="px-8 py-6 text-center">
                    <Switch 
                      checked={pref.emailEnabled} 
                      onChange={(checked) => updatePreferenceMutation.mutate({ ...pref, emailEnabled: checked })}
                      disabled={updatePreferenceMutation.isPending}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-8 bg-muted/30 border-t border-border flex items-start gap-4">
           <Info size={18} className="text-primary mt-0.5 shrink-0" />
           <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Sincronização de Canais</span>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight leading-relaxed opacity-60">
                 As notificações PWA requerem que o aplicativo esteja instalado ou adicionado à tela inicial no iOS/Android. O disparo de e-mail é processado por filas assíncronas para garantir entrega imediata.
              </p>
           </div>
        </div>

        {/* Decorative backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/notif:bg-primary/[0.02] transition-colors duration-1000" />
      </div>

      {/* Persistence State Feedback */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col gap-3">
         {updatePreferenceMutation.isPending && (
            <div className="bg-primary/10 backdrop-blur-md border border-primary/20 px-6 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
               <Loader2 size={16} className="animate-spin text-primary" />
               <span className="text-[10px] font-black text-primary uppercase tracking-widest">Sincronizando Preferências...</span>
            </div>
         )}
         {testDispatchMutation.isSuccess && (
            <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 px-6 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500 shadow-2xl">
               <CheckCircle2 size={16} className="text-emerald-500" />
               <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Disparo de Teste Efetuado</span>
            </div>
         )}
      </div>
    </div>
  );
}
