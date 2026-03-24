import { useState } from 'react';
import { useSettings } from '../../hooks/use-settings';

export function BrandingForm() {
  const { overview, updateBranding } = useSettings();
  const branding = overview.data?.branding;

  const [reportHeader, setReportHeader] = useState(branding?.reportHeader ?? '');
  const [reportFooter, setReportFooter] = useState(branding?.reportFooter ?? '');
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? '#1a56db');
  const [secondaryColor, setSecondaryColor] = useState(branding?.secondaryColor ?? '#6b7280');
  const [website, setWebsite] = useState(branding?.website ?? '');

  return (
    <div className="space-y-3">
      <h4 className="text-white font-medium">Branding</h4>
      <div className="grid md:grid-cols-2 gap-3">
        <input className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Cor primaria (#RRGGBB)" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        <input className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Cor secundaria (#RRGGBB)" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
      </div>
      <div className="flex gap-2 items-center">
        <div className="w-8 h-8 rounded border border-neutral-700" style={{ backgroundColor: primaryColor }} />
        <div className="w-8 h-8 rounded border border-neutral-700" style={{ backgroundColor: secondaryColor }} />
        <span className="text-xs text-neutral-400">Preview de cores</span>
      </div>
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Header de relatorios" value={reportHeader} onChange={(e) => setReportHeader(e.target.value)} />
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Footer de relatorios" value={reportFooter} onChange={(e) => setReportFooter(e.target.value)} />
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />

      <button
        onClick={() => updateBranding.mutate({ primaryColor, secondaryColor, reportHeader, reportFooter, website })}
        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm"
      >
        Salvar branding
      </button>
    </div>
  );
}
