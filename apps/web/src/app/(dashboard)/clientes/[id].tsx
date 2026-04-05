import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateClientSchema } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { formatBRL } from '../../../lib/format';
import { 
  ArrowLeft, Loader2, AlertCircle, ReceiptText, Pencil, 
  Link2, Plus, Trash2, ExternalLink, Hash, Calendar, 
  TrendingUp, Wallet, CheckCircle2, XCircle, User, Percent
} from 'lucide-react';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted } from '../../../components/shared/typography';
import { cn } from '../../../lib/utils';

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

  if (isLoading) return <div className="p-12 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-primary" size={32} /><Muted>Carregando blocos...</Muted></div>;

  return (
    <ScaleIn className="flex flex-col gap-6">
      <div className="flex justify-between items-center bg-card/50 p-6 rounded-[32px] border border-border/50 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
             <Hash size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Blocos Físicos (Talonários)</h2>
            <Muted className="text-[10px] uppercase font-bold tracking-widest">Controle de numeração física por parceiro</Muted>
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)} 
          className={cn(
            "flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-5 py-3 rounded-2xl transition-all active:scale-95",
            isAdding ? "bg-muted text-foreground" : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          )}
        >
          {isAdding ? <><XCircle size={14} strokeWidth={3} /> Cancelar</> : <><Plus size={14} strokeWidth={3} /> Adicionar Bloco</>}
        </button>
      </div>

      {isAdding && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-primary/5 rounded-[32px] border-2 border-primary/20 animate-in fade-in slide-in-from-top-4">
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1 text-primary">Início</label>
            <input type="number" min="1" value={start} onChange={e => setStart(e.target.value)} placeholder="0001" className="w-full bg-background border border-primary/20 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:opacity-30" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1 text-primary">Fim</label>
            <input type="number" min="1" value={end} onChange={e => setEnd(e.target.value)} placeholder="0050" className="w-full bg-background border border-primary/20 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:opacity-30" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Rótulo (Opcional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Bloco 2024" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary/50 transition-all placeholder:opacity-30" />
          </div>
          <div className="flex items-end">
            <button 
              disabled={!start || !end || Number(start) >= Number(end) || createBlock.isPending}
              onClick={() => createBlock.mutate({ clientId, startNumber: Number(start), endNumber: Number(end), label })}
              className="w-full h-[46px] text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground rounded-xl disabled:opacity-30 hover:brightness-110 shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              {createBlock.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirmar Registro'}
            </button>
          </div>
        </div>
      )}

      {blocks && blocks.length > 0 ? (
        <div className="premium-card overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Série / Intervalo</th>
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Rótulo Identificador</th>
                <th className="px-6 py-4 text-right">Controle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {blocks.map(b => (
                <tr key={b.id} className="group hover:bg-primary/[0.02] transition-colors">
                  <td className="px-6 py-5">
                    <span className="text-sm font-black tracking-tighter text-foreground font-mono">
                      {b.startNumber.toString().padStart(5, '0')} <span className="mx-2 text-muted-foreground opacity-30">→</span> {b.endNumber.toString().padStart(5, '0')}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-1 rounded-lg">
                      {b.label || 'Sem rótulo'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => confirm('Remover este bloco de numeração?') && deleteBlock.mutate({ id: b.id })} 
                      disabled={deleteBlock.isPending}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-20 text-center bg-muted/10 border-2 border-dashed border-border/50 rounded-[40px] flex flex-col items-center gap-4">
           <Hash size={48} className="text-muted-foreground opacity-20" />
           <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40">Nenhum bloco registrado para este parceiro</p>
        </div>
      )}
    </ScaleIn>
  );
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
    onSuccess: () => { 
      utils.clientes.list.invalidate(); 
      utils.clientes.get.invalidate({ id: clientId }); 
    },
  });

  const onSubmit: SubmitHandler<ClientEditFormData> = (data) => updateMutation.mutate({ id: clientId, ...data });

  if (isLoading) return (
     <div className="h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-primary" size={42} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Sincronizando dados...</p>
     </div>
  );

  if (error || !client) return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 p-8">
      <div className="w-20 h-20 bg-destructive/10 rounded-[32px] flex items-center justify-center text-destructive">
        <AlertCircle size={40} />
      </div>
      <div className="text-center space-y-2">
        <H1 className="text-destructive font-black uppercase tracking-tight">Ocorreu um erro</H1>
        <Subtitle>{error?.message ?? 'Este parceiro não foi encontrado em nossa base.'}</Subtitle>
      </div>
      <button 
        onClick={() => navigate('/clientes')} 
        className="px-8 py-4 bg-muted border border-border rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:text-primary transition-all active:scale-95"
      >
        Voltar à listagem
      </button>
    </div>
  );

  const inputClass = "w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all";
  const labelClass = "block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1";

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/clientes')} 
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground hover:text-primary transition-all active:scale-95"
          >
            <ArrowLeft size={20} strokeWidth={3} />
          </button>
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-3">
               <H1 className="tracking-tight">{client.name}</H1>
               <span className={cn(
                 "text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border",
                 client.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'
               )}>
                 {client.status === 'active' ? 'ATIVO' : 'INATIVO'}
               </span>
             </div>
             <Subtitle className="uppercase tracking-widest text-[10px] font-bold opacity-60">ID: #{clientId.toString().padStart(4, '0')}</Subtitle>
          </div>
        </div>
        
        <button
          onClick={() => navigate(`/clientes/${clientId}/portal`)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-4 bg-primary/10 text-primary border border-primary/20 rounded-[20px] shadow-sm hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
        >
          <Link2 size={14} strokeWidth={3} /> Portal do Parceiro <ExternalLink size={12} className="opacity-50 ml-1" />
        </button>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="flex gap-2 p-1.5 bg-card/50 border border-border/50 rounded-[28px] w-fit shadow-sm backdrop-blur-sm">
        {(['dados', 'extrato', 'blocos'] as const).map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em] px-8 py-3.5 rounded-[22px] transition-all",
              tab === t 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {t === 'dados' ? <Pencil size={14} strokeWidth={3} /> : t === 'extrato' ? <ReceiptText size={14} strokeWidth={3} /> : <Hash size={14} strokeWidth={3} />}
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Dados Container */}
      {tab === 'dados' && (
        <ScaleIn>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-8 flex flex-col gap-8">
               <section className="premium-card p-6 flex flex-col gap-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><User size={20} /></div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Identificação</h2>
                    <Muted className="text-[10px] uppercase font-bold tracking-widest">Informações de cadastro</Muted>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Nome Completo / Clínica *</label>
                    <input {...register('name')} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Clínica Empresa</label>
                    <input {...register('clinic')} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Responsável Direto</label>
                    <input {...register('contactPerson')} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>E-mail de Contato</label>
                    <input {...register('email')} type="email" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone / WhatsApp</label>
                    <input {...register('phone')} className={inputClass} />
                  </div>
                </div>
              </section>

              <section className="premium-card p-6 flex flex-col gap-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Percent size={20} /></div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Preferências</h2>
                    <Muted className="text-[10px] uppercase font-bold tracking-widest">Regras de negócio e técnicas</Muted>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className={labelClass}>Ajuste Tarifário Global (%)</label>
                    <div className="relative w-48">
                      <input {...register('priceAdjustmentPercent', { valueAsNumber: true })} type="number" step="0.01" className={cn(inputClass, "pr-12")} />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 bg-background border border-border rounded-lg text-xs font-black text-primary">%</div>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Observações e Preferências Técnicas</label>
                    <textarea {...register('technicalPreferences')} rows={6} className={cn(inputClass, "resize-none")} placeholder="Ex: Sempre enviar em caixa rígida, prefere protocolos X..." />
                  </div>
                </div>
              </section>
            </div>

            <div className="md:col-span-4 flex flex-col gap-6">
               <div className="premium-card p-6 flex flex-col gap-6 sticky top-8">
                  <div className="text-center space-y-2 pb-6 border-b border-border/50">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Ações de Cadastro</p>
                  </div>
                  
                  <div className="space-y-3">
                    {updateMutation.isError && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-[10px] font-black uppercase tracking-widest text-center">
                        {updateMutation.error.message}
                      </div>
                    )}
                    {updateMutation.isSuccess && (
                      <div className="flex items-center justify-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-[10px] font-black uppercase tracking-widest text-center">
                        <CheckCircle2 size={14} /> Dados Atualizados
                      </div>
                    )}
                    
                    <button 
                      type="submit" 
                      disabled={isSubmitting || updateMutation.isPending}
                      className="w-full bg-primary text-primary-foreground text-xs font-black px-6 py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                    >
                      {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} strokeWidth={3} /> Salvar Alterações</>}
                    </button>
                    
                    <div className="p-4 bg-muted/30 rounded-[28px] border border-border/30 text-center space-y-1 mt-4">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Última Atualização</p>
                       <p className="text-xs font-bold text-foreground opacity-60">
                         {client.updatedAt ? new Date(client.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Data não registrada'}
                       </p>
                    </div>
                  </div>
               </div>
            </div>
          </form>
        </ScaleIn>
      )}

      {/* Tab: Extrato (Stat Cards) */}
      {tab === 'extrato' && (
        <ScaleIn className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Volume Total de OS', value: extract?.totalJobs ?? 0, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10', isBRL: false },
              { label: 'Faturamento Bruto', value: extract?.totalRevenueCents ?? 0, icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-500/10', isBRL: true },
              { label: 'Saldo Pendente', value: extract?.pendingCents ?? 0, icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-500/10', isBRL: true },
            ].map(card => (
              <div key={card.label} className="premium-card p-8 flex flex-col gap-6 group hover:border-primary/30 transition-all">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner", card.bg, card.color)}>
                  <card.icon size={28} strokeWidth={2.5} />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary transition-colors">{card.label}</p>
                  <p className="text-4xl font-black text-foreground tracking-tighter">
                    {card.isBRL ? formatBRL(card.value as number) : card.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-8 bg-card/30 rounded-[40px] border border-border/50 text-center flex flex-col items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground opacity-40">
                <ReceiptText size={24} />
             </div>
             <div className="max-w-md">
                <p className="text-sm font-bold text-foreground mb-1">Informações Adicionais</p>
                <Muted className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                   Os dados detalhados de faturamento por item e extrato financeiro completo estarão disponíveis após a ativação total dos módulos de Produção e Financeiro.
                </Muted>
             </div>
          </div>
        </ScaleIn>
      )}

      {/* Tab: Blocos */}
      {tab === 'blocos' && <OsBlocksTab clientId={clientId} />}
    </PageTransition>
  );
}
