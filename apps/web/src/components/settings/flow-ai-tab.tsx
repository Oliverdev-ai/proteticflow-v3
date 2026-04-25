import { useEffect, useState } from 'react';
import { Mic, SlidersHorizontal, Volume2 } from 'lucide-react';
import { useAuth } from '../../hooks/use-auth';

export function FlowAiTab() {
  const { user, updateProfile } = useAuth();
  const [voiceEnabled, setVoiceEnabled] = useState(user?.aiVoiceEnabled ?? true);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>(
    user?.aiVoiceGender === 'male' ? 'male' : 'female',
  );
  const [voiceSpeed, setVoiceSpeed] = useState<number>(user?.aiVoiceSpeed ?? 1);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setVoiceEnabled(user?.aiVoiceEnabled ?? true);
    setVoiceGender(user?.aiVoiceGender === 'male' ? 'male' : 'female');
    setVoiceSpeed(user?.aiVoiceSpeed ?? 1);
  }, [user?.aiVoiceEnabled, user?.aiVoiceGender, user?.aiVoiceSpeed]);

  async function handleSave() {
    await updateProfile.mutateAsync({
      aiVoiceEnabled: voiceEnabled,
      aiVoiceGender: voiceGender,
      aiVoiceSpeed: Number(voiceSpeed.toFixed(2)),
    });

    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="rounded-[32px] border border-border/50 bg-card/30 p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Mic size={18} className="text-sky-400" />
        <div>
          <h3 className="text-lg font-black uppercase tracking-wide text-foreground">Flow IA por voz</h3>
          <p className="text-xs text-muted-foreground">
            Controle resposta audivel do assistente em todas as telas do dashboard.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <label className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Ativar resposta por voz</span>
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={(event) => setVoiceEnabled(event.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 rounded-2xl border border-border/60 bg-background/40 p-4">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Volume2 size={14} />
              Timbre
            </span>
            <select
              value={voiceGender}
              onChange={(event) => setVoiceGender(event.target.value === 'male' ? 'male' : 'female')}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-sky-500 focus:outline-none"
            >
              <option value="female">Feminina</option>
              <option value="male">Masculina</option>
            </select>
          </label>

          <label className="space-y-2 rounded-2xl border border-border/60 bg-background/40 p-4">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <SlidersHorizontal size={14} />
              Velocidade ({voiceSpeed.toFixed(2)}x)
            </span>
            <input
              type="range"
              min={0.75}
              max={1.5}
              step={0.05}
              value={voiceSpeed}
              onChange={(event) => setVoiceSpeed(Number(event.target.value))}
              className="w-full accent-sky-500"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-xs text-emerald-500">Preferencias salvas.</span> : null}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={updateProfile.isPending}
          className="rounded-2xl bg-sky-500 px-5 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateProfile.isPending ? 'Salvando...' : 'Salvar preferencias'}
        </button>
      </div>
    </div>
  );
}
