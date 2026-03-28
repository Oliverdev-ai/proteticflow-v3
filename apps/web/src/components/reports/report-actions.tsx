type ReportActionsProps = {
  disabled: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onPreview: () => void;
  onGeneratePdf: () => void;
  onExportCsv: () => void;
  onSendByEmail: () => void;
};

export function ReportActions(props: ReportActionsProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <h2 className="text-lg font-semibold text-white">Acoes</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={props.onPreview} disabled={props.disabled} className="px-4 py-2 rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-sm">Preview</button>
        <button type="button" onClick={props.onGeneratePdf} disabled={props.disabled} className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm">Gerar PDF</button>
        <button type="button" onClick={props.onExportCsv} disabled={props.disabled} className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm">Exportar CSV</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={props.email}
          onChange={(event) => props.onEmailChange(event.target.value)}
          placeholder="destinatario@exemplo.com"
          className="input-field w-full md:w-80"
        />
        <button type="button" onClick={props.onSendByEmail} disabled={props.disabled || !props.email} className="px-4 py-2 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm">Enviar por email</button>
      </div>
    </div>
  );
}
