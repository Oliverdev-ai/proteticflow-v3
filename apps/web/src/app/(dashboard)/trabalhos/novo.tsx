import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Loader2 } from 'lucide-react';
import { trpc } from '../../../lib/trpc';

type Item = {
  priceItemId?: number;
  serviceNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  adjustmentPercent: number;
};

const STEPS = ['Cliente', 'Itens', 'Detalhes', 'Revisão'];

export default function JobCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [details, setDetails] = useState({ patientName: '', prothesisType: '', material: '', color: '', instructions: '', deadline: '', notes: '' });
  const [error, setError] = useState('');

  const { data: clientsData } = trpc.clientes.list.useQuery({ limit: 100 });
  const { data: priceTablesData } = trpc.pricing.listTables.useQuery({ limit: 100 });
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const { data: priceItemsData } = trpc.pricing.listItems.useQuery(
    { pricingTableId: selectedTableId!, limit: 100 },
    { enabled: selectedTableId != null }
  );

  const createMutation = trpc.job.create.useMutation({
    onSuccess: (job) => navigate(`/trabalhos/${job.id}`),
    onError: (e) => setError(e.message),
  });

  // Client data for display
  const selectedClient = clientsData?.data.find(c => c.id === clientId);

  function addItem(priceItemId?: number, name?: string, price?: number) {
    setItems(prev => [...prev, {
      priceItemId,
      serviceNameSnapshot: name ?? '',
      quantity: 1,
      unitPriceCents: price ?? 0,
      adjustmentPercent: 0,
    }]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem<K extends keyof Item>(idx: number, key: K, value: Item[K]) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  }

  const totalCents = items.reduce((s, i) => s + Math.round(i.quantity * i.unitPriceCents * (1 + i.adjustmentPercent / 100)), 0);

  function canNext() {
    if (step === 0) return !!clientId;
    if (step === 1) return items.length > 0 && items.every(i => i.serviceNameSnapshot && i.unitPriceCents > 0);
    if (step === 2) return !!details.deadline;
    return true;
  }

  function handleSubmit() {
    if (!clientId || !details.deadline) return;
    createMutation.mutate({
      clientId,
      patientName: details.patientName || undefined,
      prothesisType: details.prothesisType || undefined,
      material: details.material || undefined,
      color: details.color || undefined,
      instructions: details.instructions || undefined,
      notes: details.notes || undefined,
      deadline: new Date(details.deadline).toISOString(),
      items,
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/trabalhos')} className="text-neutral-500 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
        <h1 className="text-xl font-bold text-white">Nova OS</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < step ? 'bg-violet-600 text-white' : i === step ? 'bg-violet-500 text-white' : 'bg-neutral-800 text-neutral-500'}`}>
              {i < step ? <Check size={13} /> : i + 1}
            </div>
            <span className={`text-xs ${i === step ? 'text-white' : 'text-neutral-500'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-violet-600' : 'bg-neutral-800'} w-4`} />}
          </div>
        ))}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
        {/* Step 0: Cliente */}
        {step === 0 && (
          <>
            <h2 className="text-sm font-semibold text-neutral-300 mb-3">Selecionar Cliente</h2>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {clientsData?.data.map(c => (
                <button key={c.id} onClick={() => setClientId(c.id)} className={`w-full text-left p-3.5 rounded-xl border transition-colors ${clientId === c.id ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800'}`}>
                  <p className="text-white text-sm font-medium">{c.name}</p>
                  {c.document && <p className="text-neutral-400 text-xs">{c.document}</p>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 1: Itens */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-300">Adicionar Itens</h2>
            {/* Selecionar da tabela de preços */}
            <div className="flex gap-2">
              <select value={selectedTableId ?? ''} onChange={e => setSelectedTableId(e.target.value ? Number(e.target.value) : null)} className="input-field flex-1 text-xs">
                <option value="">— Selecionar tabela de preços —</option>
                {priceTablesData?.data.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {selectedTableId && priceItemsData?.data.map(pi => (
              <button key={pi.id} onClick={() => addItem(pi.id, pi.name, pi.priceCents)} className="w-full flex items-center justify-between text-left p-3 rounded-xl border border-neutral-700 hover:border-violet-600 hover:bg-violet-500/10 transition-colors">
                <span className="text-sm text-white">{pi.name}</span>
                <span className="text-sm text-violet-400">{(pi.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </button>
            ))}
            <button onClick={() => addItem()} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-violet-400 transition-colors mt-2">
              <Plus size={13} /> Adicionar item avulso
            </button>

            {/* Lista de itens adicionados */}
            {items.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={item.serviceNameSnapshot} onChange={e => updateItem(i, 'serviceNameSnapshot', e.target.value)} placeholder="Nome do serviço" className="input-field flex-1 text-xs" />
                    <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} min="1" className="input-field w-16 text-xs" />
                    <input type="number" value={item.unitPriceCents} onChange={e => updateItem(i, 'unitPriceCents', Number(e.target.value))} placeholder="Centavos" className="input-field w-24 text-xs" />
                    <button onClick={() => removeItem(i)} className="text-neutral-600 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </div>
                ))}
                <p className="text-right text-sm text-violet-400 font-semibold pt-1">
                  Total: {(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Detalhes */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-300">Detalhes da OS</h2>
            {[
              { key: 'patientName', label: 'Nome do paciente' },
              { key: 'prothesisType', label: 'Tipo de prótese' },
              { key: 'material', label: 'Material' },
              { key: 'color', label: 'Cor / Tonalidade' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-neutral-400 mb-1.5">{label}</label>
                <input value={details[key as keyof typeof details]} onChange={e => setDetails(d => ({ ...d, [key]: e.target.value }))} className="input-field w-full" />
              </div>
            ))}
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Prazo de entrega *</label>
              <input type="date" value={details.deadline} onChange={e => setDetails(d => ({ ...d, deadline: e.target.value }))} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Instruções / Observações</label>
              <textarea value={details.instructions} onChange={e => setDetails(d => ({ ...d, instructions: e.target.value }))} rows={3} className="input-field w-full resize-none" />
            </div>
          </div>
        )}

        {/* Step 3: Revisão */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-300">Revisar e Confirmar</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-neutral-400">Cliente</span><span className="text-white">{selectedClient?.name}</span></div>
              {details.patientName && <div className="flex justify-between"><span className="text-neutral-400">Paciente</span><span className="text-white">{details.patientName}</span></div>}
              <div className="flex justify-between"><span className="text-neutral-400">Prazo</span><span className="text-white">{details.deadline ? new Date(details.deadline).toLocaleDateString('pt-BR') : '—'}</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">Itens</span><span className="text-white">{items.length}</span></div>
              <div className="flex justify-between border-t border-neutral-800 pt-2 mt-2"><span className="text-neutral-300 font-semibold">Total</span><span className="text-violet-400 font-bold">{(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={15} /> Voltar
          </button>
        )}
        {step < 3 ? (
          <button disabled={!canNext()} onClick={() => setStep(s => s + 1)} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            Próximo <ArrowRight size={15} />
          </button>
        ) : (
          <button disabled={createMutation.isPending} onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {createMutation.isPending ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
            {createMutation.isPending ? 'Criando...' : 'Criar OS'}
          </button>
        )}
      </div>
    </div>
  );
}
