import { useState } from 'react';

type ClientOption = {
  id: number;
  name: string;
};

type EmitNfseInput = {
  clientId: number;
  grossValueCents: number;
  serviceName?: string;
  serviceCode?: string;
  arId?: number;
};

type NfseEmitFormProps = {
  clients: ClientOption[];
  isBusy?: boolean;
  onEmit: (input: EmitNfseInput) => Promise<void>;
};

export function NfseEmitForm({ clients, isBusy = false, onEmit }: NfseEmitFormProps) {
  const [clientId, setClientId] = useState<number | null>(clients[0]?.id ?? null);
  const [grossValue, setGrossValue] = useState('0');
  const [serviceName, setServiceName] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [arId, setArId] = useState('');

  async function handleSubmit(): Promise<void> {
    if (!clientId) return;
    const parsedAmount = Number(grossValue);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    const payload: EmitNfseInput = {
      clientId,
      grossValueCents: Math.round(parsedAmount * 100),
    };

    if (serviceName.trim().length > 0) payload.serviceName = serviceName.trim();
    if (serviceCode.trim().length > 0) payload.serviceCode = serviceCode.trim();
    if (arId) payload.arId = Number(arId);

    await onEmit(payload);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-white">Emitir NFS-e (unitaria)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-sm text-neutral-300">
          Cliente
          <select
            value={clientId ?? ''}
            onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : null)}
            className="input-field mt-1 w-full"
          >
            <option value="">Selecione</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Valor bruto (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={grossValue}
            onChange={(event) => setGrossValue(event.target.value)}
            className="input-field mt-1 w-full"
          />
        </label>

        <label className="text-sm text-neutral-300">
          AR vinculada (opcional)
          <input
            type="number"
            min="1"
            value={arId}
            onChange={(event) => setArId(event.target.value)}
            className="input-field mt-1 w-full"
            placeholder="ID da conta a receber"
          />
        </label>

        <label className="text-sm text-neutral-300">
          Nome do servico (opcional)
          <input
            type="text"
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            className="input-field mt-1 w-full"
            placeholder="Sobrescreve o padrao"
          />
        </label>

        <label className="text-sm text-neutral-300">
          Codigo do servico (opcional)
          <input
            type="text"
            value={serviceCode}
            onChange={(event) => setServiceCode(event.target.value)}
            className="input-field mt-1 w-full"
            placeholder="Ex.: 1401"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isBusy || !clientId}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50"
      >
        Emitir NFS-e
      </button>
    </div>
  );
}
