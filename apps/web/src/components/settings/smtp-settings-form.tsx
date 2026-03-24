import { useState } from 'react';
import { useSettings } from '../../hooks/use-settings';

export function SmtpSettingsForm() {
  const { overview, updateSmtp, testSmtp } = useSettings();
  const smtp = overview.data?.smtp;

  const [smtpMode, setSmtpMode] = useState<'resend_fallback' | 'custom_smtp'>(smtp?.smtpMode ?? 'resend_fallback');
  const [smtpHost, setSmtpHost] = useState(smtp?.smtpHost ?? '');
  const [smtpPort, setSmtpPort] = useState(smtp?.smtpPort?.toString() ?? '587');
  const [smtpSecure, setSmtpSecure] = useState(Boolean(smtp?.smtpSecure));
  const [smtpUsername, setSmtpUsername] = useState(smtp?.smtpUsername ?? '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState(smtp?.smtpFromName ?? '');
  const [smtpFromEmail, setSmtpFromEmail] = useState(smtp?.smtpFromEmail ?? '');

  return (
    <div className="space-y-3">
      <h4 className="text-white font-medium">SMTP</h4>
      <select
        value={smtpMode}
        onChange={(e) => setSmtpMode(e.target.value as 'resend_fallback' | 'custom_smtp')}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
      >
        <option value="resend_fallback">resend_fallback</option>
        <option value="custom_smtp">custom_smtp</option>
      </select>

      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="SMTP host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="SMTP port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="SMTP username" value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} />
      <input type="password" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder={smtp?.hasPassword ? '******** (senha salva)' : 'SMTP password'} value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} />
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Remetente nome" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} />
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Remetente email" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} />

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
        Usar SMTP secure
      </label>

      <div className="flex gap-2">
        <button
          onClick={() => updateSmtp.mutate({
            smtpMode,
            smtpHost,
            smtpPort: Number(smtpPort),
            smtpSecure,
            smtpUsername,
            smtpPassword: smtpPassword || undefined,
            smtpFromName,
            smtpFromEmail,
          })}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Salvar SMTP
        </button>
        <button onClick={() => testSmtp.mutate({})} className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg text-sm">
          Testar conexao
        </button>
      </div>
    </div>
  );
}
