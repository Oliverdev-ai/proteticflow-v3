import { useEffect, useMemo, useState } from 'react';
import { Bell, Clock3, Loader2, Save } from 'lucide-react';
import { PROACTIVE_ALERT_LABELS } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';

type DraftState = {
  briefingEnabled: boolean;
  briefingTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  channels: {
    push: boolean;
    email: boolean;
    whatsapp: boolean;
    in_app: boolean;
  };
  alertTypesMuted: Array<keyof typeof PROACTIVE_ALERT_LABELS>;
};

const ALERT_TYPES = Object.entries(PROACTIVE_ALERT_LABELS) as Array<
  [keyof typeof PROACTIVE_ALERT_LABELS, string]
>;

const CHANNEL_OPTIONS: Array<{ key: keyof DraftState['channels']; label: string }> = [
  { key: 'push', label: 'Push' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'in_app', label: 'In-App' },
];

export function ProactivePreferencesTab() {
  const utils = trpc.useUtils();
  const preferencesQuery = trpc.notification.getUserPreferences.useQuery();
  const updateMutation = trpc.notification.updateUserPreferences.useMutation({
    onSuccess: async () => {
      await utils.notification.getUserPreferences.invalidate();
    },
  });
  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    const data = preferencesQuery.data;
    if (!data) return;
    setDraft({
      briefingEnabled: data.briefingEnabled,
      briefingTime: data.briefingTime,
      quietHoursStart: data.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd,
      channels: {
        push: data.channels.push,
        email: data.channels.email,
        whatsapp: data.channels.whatsapp,
        in_app: data.channels.in_app,
      },
      alertTypesMuted: [...data.alertTypesMuted],
    });
  }, [preferencesQuery.data]);

  const isDirty = useMemo(() => {
    const data = preferencesQuery.data;
    if (!data || !draft) return false;
    return JSON.stringify({
      ...draft,
      alertTypesMuted: [...draft.alertTypesMuted].sort(),
    }) !== JSON.stringify({
      briefingEnabled: data.briefingEnabled,
      briefingTime: data.briefingTime,
      quietHoursStart: data.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd,
      channels: {
        push: data.channels.push,
        email: data.channels.email,
        whatsapp: data.channels.whatsapp,
        in_app: data.channels.in_app,
      },
      alertTypesMuted: [...data.alertTypesMuted].sort(),
    });
  }, [draft, preferencesQuery.data]);

  if (preferencesQuery.isLoading || !draft) {
    return (
      <div className="rounded-[32px] border border-border/50 bg-card/30 p-8 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="animate-spin" size={16} />
        <span className="text-sm font-semibold">Carregando preferências proativas...</span>
      </div>
    );
  }

  const handleToggleAlertType = (alertType: keyof typeof PROACTIVE_ALERT_LABELS) => {
    setDraft((current) => {
      if (!current) return current;
      const exists = current.alertTypesMuted.includes(alertType);
      return {
        ...current,
        alertTypesMuted: exists
          ? current.alertTypesMuted.filter((item) => item !== alertType)
          : [...current.alertTypesMuted, alertType],
      };
    });
  };

  const save = async () => {
    await updateMutation.mutateAsync({
      briefingEnabled: draft.briefingEnabled,
      briefingTime: draft.briefingTime,
      quietHoursStart: draft.quietHoursStart,
      quietHoursEnd: draft.quietHoursEnd,
      channels: draft.channels,
      alertTypesMuted: draft.alertTypesMuted,
    });
  };

  return (
    <div className="rounded-[32px] border border-border/50 bg-card/30 p-8 space-y-8">
      <div className="flex items-center gap-3">
        <Bell size={18} className="text-primary" />
        <div>
          <h3 className="text-lg font-black uppercase tracking-wide text-foreground">Preferências Proativas</h3>
          <p className="text-xs text-muted-foreground">
            Configure briefing diário, quiet hours e canais de entrega do motor proativo.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-2xl border border-border/60 bg-background/40 p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Briefing diário</span>
          <input
            type="checkbox"
            checked={draft.briefingEnabled}
            onChange={(event) => setDraft((current) => current ? ({
              ...current,
              briefingEnabled: event.target.checked,
            }) : current)}
            className="h-4 w-4 accent-sky-500"
          />
        </label>

        <label className="rounded-2xl border border-border/60 bg-background/40 p-4 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horário do briefing</span>
          <input
            type="time"
            value={draft.briefingTime}
            onChange={(event) => setDraft((current) => current ? ({
              ...current,
              briefingTime: event.target.value,
            }) : current)}
            className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-2xl border border-border/60 bg-background/40 p-4 flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock3 size={14} />
            Quiet hours (início)
          </span>
          <input
            type="time"
            value={draft.quietHoursStart}
            onChange={(event) => setDraft((current) => current ? ({
              ...current,
              quietHoursStart: event.target.value,
            }) : current)}
            className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="rounded-2xl border border-border/60 bg-background/40 p-4 flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock3 size={14} />
            Quiet hours (fim)
          </span>
          <input
            type="time"
            value={draft.quietHoursEnd}
            onChange={(event) => setDraft((current) => current ? ({
              ...current,
              quietHoursEnd: event.target.value,
            }) : current)}
            className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-4">
        <h4 className="text-sm font-black uppercase tracking-wide text-foreground">Canais</h4>
        <div className="grid gap-3 md:grid-cols-2">
          {CHANNEL_OPTIONS.map((channelOption) => (
            <label key={channelOption.key} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
              <span className="text-sm font-medium">{channelOption.label}</span>
              <input
                type="checkbox"
                checked={draft.channels[channelOption.key]}
                onChange={(event) => setDraft((current) => current ? ({
                  ...current,
                  channels: {
                    ...current.channels,
                    [channelOption.key]: event.target.checked,
                  },
                }) : current)}
                className="h-4 w-4 accent-sky-500"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-4">
        <h4 className="text-sm font-black uppercase tracking-wide text-foreground">Silenciar alertas</h4>
        <div className="grid gap-3 md:grid-cols-2">
          {ALERT_TYPES.map(([alertType, label]) => (
            <label key={alertType} className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2">
              <input
                type="checkbox"
                checked={draft.alertTypesMuted.includes(alertType)}
                onChange={() => handleToggleAlertType(alertType)}
                className="h-4 w-4 accent-sky-500"
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={updateMutation.isPending || !isDirty}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {updateMutation.isPending ? 'Salvando...' : 'Salvar preferências'}
        </button>
      </div>
    </div>
  );
}
