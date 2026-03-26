import { useMemo } from 'react';
import { trpc } from '../../lib/trpc';
import { NOTIFICATION_EVENT_LABELS } from '@proteticflow/shared';

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
      alert('Push nao suportado neste navegador.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Permissao de notificacao nao concedida.');
      return;
    }

    const vapidKey = vapidQuery.data?.key;
    if (!vapidKey) {
      alert('VAPID public key nao configurada no servidor.');
      return;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(vapidKey),
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      alert('Nao foi possivel ler os dados da inscricao push.');
      return;
    }

    await saveSubscriptionMutation.mutateAsync({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    });

    alert('Push habilitado com sucesso.');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Notificacoes</h2>
        <p className="text-sm text-neutral-400 mt-1">Preferencias de notificacoes por canal.</p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/50">
              <th className="px-4 py-3 text-left text-xs uppercase text-neutral-500">Evento</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-neutral-500">In-app</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-neutral-500">Push</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-neutral-500">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {preferences.map((pref) => (
              <tr key={pref.eventKey}>
                <td className="px-4 py-3 text-sm text-neutral-200">
                  {NOTIFICATION_EVENT_LABELS[pref.eventKey]}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pref.inAppEnabled}
                    onChange={(event) =>
                      updatePreferenceMutation.mutate({
                        ...pref,
                        inAppEnabled: event.target.checked,
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pref.pushEnabled}
                    onChange={(event) =>
                      updatePreferenceMutation.mutate({
                        ...pref,
                        pushEnabled: event.target.checked,
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pref.emailEnabled}
                    onChange={(event) =>
                      updatePreferenceMutation.mutate({
                        ...pref,
                        emailEnabled: event.target.checked,
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePushSubscribe}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
        >
          Habilitar Push (PWA)
        </button>
        <button
          type="button"
          onClick={() => testDispatchMutation.mutate({ message: 'Teste manual de notificacao' })}
          className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium"
        >
          Enviar Notificacao de Teste
        </button>
      </div>
    </div>
  );
}
