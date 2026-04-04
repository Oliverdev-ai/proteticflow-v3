import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateClientSchema } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Loader2, AlertCircle, ReceiptText, Pencil, Link2, Plus, Trash2 } from 'lucide-react';

type ClientEditFormInput = z.input<typeof updateClientSchema>;
type ClientEditFormData = z.output<typeof updateClientSchema>;

function OsBlocksTab({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const { data: blocks, isLoading } = trpc.job.listOsBlocks.useQuery({ clientId });
  const [isAdding, setIsAdding] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [label, setLabel] = useState('');
  
  const createBlock = trpc.job.createOsBlock.useMutation({
    onSuccess: () => {
      utils.job.listOsBlocks.invalidate({ clientId });
      setIsAdding(false);
      setStart(''); setEnd(''); setLabel('');
    }
  });

  const deleteBlock = trpc.job.deleteOsBlock.useMutation({
    onSuccess: () => utils.job.listOsBlocks.invalidate({ clientId })
  });

  if (isLoading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-violet-400" /></div>;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-neutral-300">Blocos Físicos de OS</h2>
        <button onClick={() => setIsAdding(!isAdding)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors">
          <Plus size={14} /> Novo Bloco
        </button>
      </div>

      {isAdding && (
        <div className="flex gap-2 items-end p-3 bg-neutral-800 rounded-xl border border-neutral-700">
          <label className="flex flex-col text-xs text-neutral-400">Início
            <input type="number" min="1" value={start} onChange={e => setStart(e.target.value)} className="input-field mt-1" />
          </label>
          <label className="flex flex-col text-xs text-neutral-400">Fim
            <input type="number" min="1" value={end} onChange={e => setEnd(e.target.value)} className="input-field mt-1" />
          </label>
          <label className="flex flex-col text-xs text-neutral-400">Rótulo (opcional)
            <input value={label} onChange={e => setLabel(e.target.value)} className="input-field mt-1" />
          </label>
          <button 
            disabled={!start || !end || Number(start) >= Number(end) || createBlock.isPending}
            onClick={() => createBlock.mutate({ clientId, startNumber: Number(start), endNumber: Number(end), label })}
            className="h-[38px] px-4 text-xs font-semibold bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg">
            Salvar
          </button>
        </div>
      )}
      {createBlock.isError && <p className="text-red-400 text-xs">{createBlock.error.message}</p>}

      {blocks && blocks.length > 0 ? (
        <div className="overflow-hidden border border-neutral-800 rounded-xl">
          <table className="w-full text-left text-sm text-neutral-400">
            <thead className="bg-neutral-800 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Intervalo</th>
                <th className="px-4 py-2 font-medium">Rótulo</th>
                <th className="px-4 py-2 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {blocks.map(b => (
                <tr key={b.id} className="hover:bg-neutral-800/50">
                  <td className="px-4 py-3 font-medium text-white">{b.startNumber.toString().padStart(5, '0')} - {b.endNumber.toString().padStart(5, '0')}</td>
                  <td className="px-4 py-3">{b.label || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => confirm('Remover bloco?') && deleteBlock.mutate({ id: b.id })} disabled={deleteBlock.isPending} className="text-neutral-500 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 italic">Nenhum bloco registrado.</p>
      )}
    </div>
  );
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ClientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const clientId = parseInt(id ?? '0', 10);
  const [tab, setTab] = useState<'dados' | 'extrato' | 'blocos'>('dados');
  const utils = trpc.useUtils();

  const { data: client, isLoading, error } = trpc.clientes.get.useQuery({ id: clientId });
  const { data: extract } = trpc.clientes.getExtract.useQuery({ id: clientId }, { enabled: tab === 'extrato' });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ClientEditFormInput, unknown, ClientEditFormData>({
    resolver: zodResolver(updateClientSchema),
  });

  useEffect(() => {
    if (!client) return;
    reset({
      name: client.name,
      clinic: client.clinic ?? undefined,
      contactPerson: client.contactPerson ?? undefined,
      email: client.email ?? undefined,
      phone: client.phone ?? undefined,
      phone2: client.phone2 ?? undefined,
      documentType: client.documentType ?? undefined,
      document: client.document ?? undefined,
      street: client.street ?? undefined,
      addressNumber: client.addressNumber ?? undefined,
      complement: client.complement ?? undefined,
      neighborhood: client.neighborhood ?? undefined,
      city: client.city ?? undefined,
      state: client.state ?? undefined,
      zipCode: client.zipCode ?? undefined,
      technicalPreferences: client.technicalPreferences ?? undefined,
      priceAdjustmentPercent: Number(client.priceAdjustmentPercent ?? 0),
      pricingTableId: client.pricingTableId ?? undefined,
    });
  }, [client, reset]);

  const updateMutation = trpc.clientes.update.useMutation({
    onSuccess: () => { utils.clientes.list.invalidate(); utils.clientes.get.invalidate({ id: clientId }); },
  });

  const onSubmit: SubmitHandler<ClientEditFormData> = (data) => updateMutation.mutate({ id: clientId, ...data });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-violet-400" size={32} /></div>;
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-red-400 text-sm">{error?.message ?? 'Cliente não encontrado'}</p>
        <button onClick={() => navigate('/clientes')} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">← Voltar</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/clientes')} className="text-neutral-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white">{client.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${client.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-neutral-700 text-neutral-400'}`}>
            {client.status === 'active' ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/clientes/${clientId}/portal`)}
          className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
        >
          <Link2 size={13} />
          Portal do cliente
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-900 p-1 rounded-xl w-fit flex-shrink-0">
        {(['dados', 'extrato', 'blocos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors capitalize ${tab === t ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
            {t === 'dados' ? <Pencil size={13} /> : t === 'extrato' ? <ReceiptText size={13} /> : <Link2 size={13} />}
            {t === 'dados' ? 'Dados' : t === 'extrato' ? 'Extrato' : 'Blocos'}
          </button>
        ))}
      </div>

      {/* Tab: Dados */}
      {tab === 'dados' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-300">Informações gerais</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-neutral-400 mb-1.5">Nome *</label>
                <input {...register('name')} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Clínica</label>
                <input {...register('clinic')} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Pessoa de contato</label>
                <input {...register('contactPerson')} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Email</label>
                <input {...register('email')} type="email" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Telefone</label>
                <input {...register('phone')} className="input-field w-full" />
              </div>
            </div>
          </section>

          <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-300">Preferências</h2>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Ajuste de preço (%)</label>
              <input {...register('priceAdjustmentPercent', { valueAsNumber: true })} type="number" step="0.01" min="-100" max="100" className="input-field w-48" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Preferências técnicas</label>
              <textarea {...register('technicalPreferences')} rows={3} className="input-field w-full resize-none" />
            </div>
          </section>

          {updateMutation.error && <p className="text-red-400 text-sm">{updateMutation.error.message}</p>}
          {updateMutation.isSuccess && <p className="text-green-400 text-sm">Salvo com sucesso!</p>}

          <button type="submit" disabled={isSubmitting || updateMutation.isPending}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {updateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar alterações'}
          </button>
        </form>
      )}

      {/* Tab: Extrato */}
      {tab === 'extrato' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total de OS', value: extract?.totalJobs ?? 0, isNumber: true },
            { label: 'Receita total', value: formatCents(extract?.totalRevenueCents ?? 0), isNumber: false },
            { label: 'Pendente a receber', value: formatCents(extract?.pendingCents ?? 0), isNumber: false },
          ].map(card => (
            <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <p className="text-xs text-neutral-500 mb-2">{card.label}</p>
              <p className="text-2xl font-bold text-white">{card.isNumber ? card.value : ''}{!card.isNumber ? card.value : ''}</p>
            </div>
          ))}
          <p className="col-span-3 text-xs text-neutral-600">Dados de OS e financeiro disponíveis após Fases 6 e 8 respectivamente.</p>
        </div>
      )}

      {/* Tab: Blocos */}
      {tab === 'blocos' && <OsBlocksTab clientId={clientId} />}
    </div>
  );
}
