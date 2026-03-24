import { useState } from 'react';
import { useSettings } from '../../hooks/use-settings';

export function PrinterSettingsForm() {
  const { overview, updatePrinter } = useSettings();
  const printer = overview.data?.printer;

  const [host, setHost] = useState(printer?.printerHost ?? '');
  const [port, setPort] = useState(printer?.printerPort?.toString() ?? '9100');

  return (
    <div className="space-y-3">
      <h4 className="text-white font-medium">Impressora local</h4>
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Host da impressora" value={host} onChange={(e) => setHost(e.target.value)} />
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Porta" value={port} onChange={(e) => setPort(e.target.value)} />
      <button
        onClick={() => updatePrinter.mutate({ printerHost: host, printerPort: Number(port) })}
        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm"
      >
        Salvar impressora
      </button>
    </div>
  );
}
