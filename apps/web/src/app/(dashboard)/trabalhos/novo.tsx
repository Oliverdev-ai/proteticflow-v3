import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Loader2,
  User,
  Briefcase,
  Calendar,
  Info,
  Hash,
  Zap,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  Activity,
  FileText,
  Landmark,
  AlertCircle,
} from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';
import { cn } from '../../../lib/utils';
import { formatBRL } from '../../../lib/format';

type Item = {
  priceItemId?: number;
  serviceNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  adjustmentPercent: number;
};

const STEPS = [
  { id: 'cliente', label: 'MandatÃ¡rio', icon: User, desc: 'IdentificaÃ§Ã£o do parceiro' },
  { id: 'itens', label: 'ComposiÃ§Ã£o', icon: Briefcase, desc: 'ServiÃ§os e valoraÃ§Ã£o' },
  { id: 'detalhes', label: 'EspecÃ­ficos', icon: Calendar, desc: 'Dados tÃ©cnicos e prazo' },
  { id: 'revisao', label: 'RevisÃ£o', icon: ShieldCheck, desc: 'ValidaÃ§Ã£o final' },
];

export default function JobCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [details, setDetails] = useState({
    patientName: '',
    prothesisType: '',
    material: '',
    color: '',
    instructions: '',
    deadline: '',
    notes: '',
  });
  const [jobSubType, setJobSubType] = useState<'standard' | 'proof' | 'rework'>('standard');
  const [isUrgent, setIsUrgent] = useState(false);
  const [proofDueDate, setProofDueDate] = useState('');
  const [reworkParentId, setReworkParentId] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [osNumber, setOsNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-resolver cliente pelo nÃºmero da OS (F30)
  const resolveQuery = trpc.job.resolveClientByOsNumber.useQuery(
    { osNumber: Number(osNumber) },
    { enabled: osNumber.length >= 1 && !isNaN(Number(osNumber)), retry: false },
  );

  useEffect(() => {
    if (resolveQuery.data && !clientId) {
      setClientId(resolveQuery.data.clientId);
    }
  }, [resolveQuery.data, clientId]);

  const { data: clientsData } = trpc.clientes.list.useQuery({ limit: 100 });
  const { data: priceTablesData } = trpc.pricing.listTables.useQuery({ limit: 100 });
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const { data: priceItemsData } = trpc.pricing.listItems.useQuery(
    { pricingTableId: selectedTableId!, limit: 100 },
    { enabled: selectedTableId != null },
  );

  const createMutation = trpc.job.create.useMutation({
    onSuccess: (job) => navigate(`/trabalhos/${job.id}`),
    onError: (e) => setError(e.message),
  });

  // Client data for display
  const selectedClient = clientsData?.data.find((c) => c.id === clientId);

  function addItem(priceItemId?: number, name?: string, price?: number) {
    setItems((prev) => {
      const nextItem: Item = {
        serviceNameSnapshot: name ?? '',
        quantity: 1,
        unitPriceCents: price ?? 0,
        adjustmentPercent: 0,
      };
      if (priceItemId !== undefined) {
        nextItem.priceItemId = priceItemId;
      }
      return [...prev, nextItem];
    });
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem<K extends keyof Item>(idx: number, key: K, value: Item[K]) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  const totalCents = items.reduce(
    (s, i) => s + Math.round(i.quantity * i.unitPriceCents * (1 + i.adjustmentPercent / 100)),
    0,
  );

  function canNext() {
    if (step === 0) return !!clientId;
    if (step === 1)
      return items.length > 0 && items.every((i) => i.serviceNameSnapshot && i.unitPriceCents > 0);
    if (step === 2) {
      if (!details.deadline) return false;
      if (jobSubType === 'proof') return !!proofDueDate;
      if (jobSubType === 'rework')
        return reworkReason.trim().length >= 3 && Number(reworkParentId) > 0;
      return true;
    }
    return true;
  }

  function handleSubmit() {
    if ((!clientId && !osNumber) || !details.deadline) return;
    createMutation.mutate({
      clientId: clientId ?? undefined,
      osNumber: osNumber ? Number(osNumber) : undefined,
      jobSubType,
      isUrgent,
      proofDueDate:
        jobSubType === 'proof' && proofDueDate ? new Date(proofDueDate).toISOString() : undefined,
      reworkParentId:
        jobSubType === 'rework' && Number(reworkParentId) > 0 ? Number(reworkParentId) : undefined,
      reworkReason: jobSubType === 'rework' ? reworkReason.trim() || undefined : undefined,
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

  const inputClass =
    'w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner';
  const labelClass =
    'block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1';

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-5xl mx-auto pb-32">
      {/* Header Area */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => (step > 0 ? setStep((s) => s - 1) : navigate('/trabalhos'))}
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft size={20} strokeWidth={3} />
        </button>
        <div className="flex flex-col gap-0.5">
          <H1 className="tracking-tight">Iniciando OS</H1>
          <Subtitle>ConfiguraÃ§Ã£o e registro de nova ordem de serviÃ§o tÃ©cnica</Subtitle>
        </div>
      </div>

      {/* Modern Step Indicator Overlay */}
      <div className="bg-card/30 backdrop-blur-sm p-6 rounded-[32px] border border-border">
        <div className="relative flex items-center justify-between gap-4 max-w-3xl mx-auto">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-3 flex-1 relative z-10">
              <div
                className={cn(
                  'w-12 h-12 rounded-[20px] flex items-center justify-center text-sm font-black transition-all duration-500 shadow-lg',
                  i < step
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : i === step
                      ? 'bg-primary text-primary-foreground shadow-primary/30 scale-110 ring-4 ring-primary/10'
                      : 'bg-muted text-muted-foreground border border-border opacity-40',
                )}
              >
                {i < step ? (
                  <CheckCircle2 size={24} strokeWidth={2.5} />
                ) : (
                  <s.icon size={20} strokeWidth={2.5} />
                )}
              </div>
              <div className="hidden md:flex flex-col items-center text-center gap-0.5">
                <span
                  className={cn(
                    'text-[10px] font-black uppercase tracking-widest',
                    i === step ? 'text-primary' : 'text-muted-foreground opacity-60',
                  )}
                >
                  {s.label}
                </span>
                <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-tighter w-24">
                  {s.desc}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'absolute left-[calc(50%+24px)] right-[calc(-50%+24px)] top-6 h-0.5 rounded-full transition-all duration-700',
                    i < step ? 'bg-emerald-500/50' : 'bg-muted/50',
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="premium-card p-2 min-h-[500px] relative overflow-hidden">
        {/* Step 0: MandatÃ¡rio (Cliente) */}
        {step === 0 && (
          <ScaleIn className="p-8 flex flex-col gap-10">
            {/* OS Physycal Resolver */}
            <div className="p-10 rounded-[32px] bg-primary/[0.02] border border-primary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="flex flex-col gap-6 relative">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                    <Zap size={22} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Large className="tracking-tight">Resgate Automatizado</Large>
                    <Muted className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      IdentificaÃ§Ã£o por OS FÃ­sica
                    </Muted>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className={labelClass}>NÃºmero Sequencial (Ficha)</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Ex. 1405"
                      value={osNumber}
                      onChange={(e) => setOsNumber(e.target.value)}
                      className={cn(inputClass, 'text-lg font-black tracking-widest tabular-nums')}
                    />
                    <Hash
                      className="absolute right-6 top-1/2 -translate-y-1/2 text-primary/30"
                      size={20}
                      strokeWidth={3}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 font-medium ml-1">
                    A identificaÃ§Ã£o do parceiro ocorrerÃ¡ em tempo real baseado no prefixo da OS.
                  </p>
                </div>
              </div>
            </div>

            {/* Client List Selection */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between ml-1 border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-3 bg-primary rounded-full" />
                  <Muted className="text-[10px] font-black uppercase tracking-[0.3em]">
                    SeleÃ§Ã£o Direta de Parceiro
                  </Muted>
                </div>
                {!clientId && osNumber && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
                    <Loader2 size={12} className="animate-spin text-amber-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                      Buscando Registro...
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {resolveQuery.data && (
                  <div className="md:col-span-2 p-6 rounded-3xl bg-emerald-500/[0.03] border-2 border-emerald-500 ring-4 ring-emerald-500/10 flex items-center justify-between shadow-2xl animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 flex items-center justify-center rounded-[24px] bg-emerald-500 text-white shadow-xl shadow-emerald-500/30">
                        <CheckCircle2 size={28} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                          Parceiro Identificado na OS #{osNumber}
                        </span>
                        <Large className="text-2xl font-black tracking-tighter leading-none">
                          {resolveQuery.data.clientName}
                        </Large>
                      </div>
                    </div>
                    <button className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:brightness-110 transition-all">
                      Trocar Parceiro
                    </button>
                  </div>
                )}

                {!resolveQuery.data &&
                  clientsData?.data.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setClientId(clientId === c.id ? null : c.id)}
                      className={cn(
                        'group p-6 rounded-3xl border-2 transition-all duration-500 relative overflow-hidden flex items-center gap-6 text-left active:scale-[0.98]',
                        clientId === c.id
                          ? 'border-primary bg-primary/[0.03] shadow-xl shadow-primary/10'
                          : 'border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/80',
                      )}
                    >
                      <div
                        className={cn(
                          'w-12 h-12 flex items-center justify-center rounded-2xl border transition-all duration-500 shadow-inner',
                          clientId === c.id
                            ? 'bg-primary text-white border-primary shadow-primary/20'
                            : 'bg-card border-border text-muted-foreground opacity-40 group-hover:opacity-100',
                        )}
                      >
                        {clientId === c.id ? (
                          <Check size={20} strokeWidth={3} />
                        ) : (
                          <User size={20} />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span
                          className={cn(
                            'text-sm font-black tracking-tight leading-none mb-1',
                            clientId === c.id ? 'text-primary' : 'text-foreground',
                          )}
                        >
                          {c.name}
                        </span>
                        <div className="flex items-center gap-2 opacity-40">
                          <Landmark size={10} />
                          <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                            {c.document || 'Sem Documento'}
                          </span>
                        </div>
                      </div>
                      {clientId === c.id && (
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-700" />
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </ScaleIn>
        )}

        {/* Step 1: ComposiÃ§Ã£o (Itens) */}
        {step === 1 && (
          <ScaleIn className="p-8 flex flex-col gap-10">
            <div className="flex items-center justify-between pb-8 border-b border-border/50 relative">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                  <Briefcase size={22} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Large className="tracking-tight">CatÃ¡logo de ServiÃ§os</Large>
                  <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                    SeleÃ§Ã£o tÃ©cnica e valoraÃ§Ã£o parcial
                  </Muted>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                  Faturamento Estimado
                </span>
                <Large className="text-3xl font-black text-primary tracking-tighter tabular-nums leading-none">
                  {formatBRL(totalCents)}
                </Large>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Selector Sidebar */}
              <div className="md:col-span-4 space-y-6">
                <div className="flex flex-col gap-2">
                  <label className={labelClass}>Tabela de Auditoria</label>
                  <div className="relative">
                    <select
                      value={selectedTableId ?? ''}
                      onChange={(e) =>
                        setSelectedTableId(e.target.value ? Number(e.target.value) : null)
                      }
                      className={cn(inputClass, 'px-5 pr-10 appearance-none cursor-pointer')}
                    >
                      <option value="">â€” SELECIONAR TABELA â€”</option>
                      {priceTablesData?.data.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronRight
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/30 rotate-90"
                      size={18}
                      strokeWidth={3}
                    />
                  </div>
                </div>

                {selectedTableId && (
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    <Muted className="text-[9px] font-bold uppercase tracking-widest ml-1 mb-1">
                      Itens DisponÃ­veis
                    </Muted>
                    {priceItemsData?.data.map((pi) => (
                      <button
                        key={pi.id}
                        onClick={() => addItem(pi.id, pi.name, pi.priceCents)}
                        className="group flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/[0.03] transition-all text-left shadow-sm active:scale-95"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-black text-foreground group-hover:text-primary transition-colors tracking-tight leading-tight">
                            {pi.name}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground opacity-50">
                            {formatBRL(pi.priceCents)}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-all group-hover:scale-110">
                          <Plus size={14} strokeWidth={3} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => addItem()}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-dashed border-border text-[9px] font-black text-muted-foreground uppercase tracking-widest hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all active:scale-95"
                >
                  <Plus size={14} strokeWidth={3} /> Adicionar Manualmente
                </button>
              </div>

              {/* Composed List */}
              <div className="md:col-span-8 space-y-4">
                <div className="flex items-center gap-3 ml-1 mb-2">
                  <div className="w-1 h-3 bg-primary rounded-full" />
                  <Muted className="text-[10px] font-black uppercase tracking-[0.3em]">
                    ComposiÃ§Ã£o da OS
                  </Muted>
                  <div className="flex-1 border-t border-border/40" />
                </div>

                <div className="flex flex-col gap-3 min-h-[300px]">
                  {items.length > 0 ? (
                    items.map((item, i) => (
                      <div
                        key={i}
                        className="flex gap-4 items-center group p-4 rounded-[24px] bg-card border border-border hover:border-primary/30 transition-all duration-500 animate-in slide-in-from-right-4"
                      >
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted border border-border shadow-inner text-muted-foreground font-black text-[10px]">
                          {i + 1}
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <input
                            value={item.serviceNameSnapshot}
                            onChange={(e) => updateItem(i, 'serviceNameSnapshot', e.target.value)}
                            placeholder="DescriÃ§Ã£o do ServiÃ§o..."
                            className="w-full bg-transparent border-none text-sm font-black text-foreground placeholder:text-muted-foreground/30 focus:ring-0 p-0"
                          />
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                Qtd:
                              </span>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                                min="1"
                                className="w-12 bg-muted/40 border-none rounded-lg text-xs font-black text-center text-foreground p-0 px-1 py-0.5 focus:bg-muted"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                Un:
                              </span>
                              <div className="relative">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-500/40">
                                  R$
                                </span>
                                <input
                                  type="number"
                                  value={item.unitPriceCents / 100}
                                  onChange={(e) =>
                                    updateItem(i, 'unitPriceCents', Number(e.target.value) * 100)
                                  }
                                  className="w-20 bg-muted/40 border-none rounded-lg text-xs font-black text-right text-emerald-500 p-0 pl-4 px-1 py-0.5 focus:bg-muted tabular-nums"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 px-4 border-l border-border/50">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                            Subtotal
                          </span>
                          <span className="text-sm font-black text-primary tabular-nums tracking-tighter">
                            {formatBRL(Math.round(item.quantity * item.unitPriceCents))}
                          </span>
                        </div>
                        <button
                          onClick={() => removeItem(i)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive hover:text-white transition-all active:scale-90"
                        >
                          <Trash2 size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 border-2 border-dashed border-border rounded-[40px] bg-muted/5 opacity-60">
                      <div className="w-20 h-20 flex items-center justify-center rounded-[32px] bg-muted border border-border text-muted-foreground/30 ring-8 ring-muted/20">
                        <Briefcase size={32} strokeWidth={2.5} />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-black text-foreground uppercase tracking-widest">
                          Nenhum ServiÃ§o Composto
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium max-w-[200px]">
                          Utilize o seletor lateral para compor a ficha tÃ©cnica desta OS.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScaleIn>
        )}

        {/* Step 2: EspecÃ­ficos (Detalhes) */}
        {step === 2 && (
          <ScaleIn className="p-8 flex flex-col gap-10">
            <div className="flex items-center justify-between pb-8 border-b border-border/50 relative">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                  <Calendar size={22} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Large className="tracking-tight">Detalhamento TÃ©cnico</Large>
                  <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Metadados da produÃ§Ã£o e cronograma
                  </Muted>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              {/* Visual Anchor Decoration */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none scale-150">
                <FileText size={400} />
              </div>

              <div className="group/field relative">
                <label className={labelClass}>Nome do Paciente *</label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 group-focus-within/field:text-primary transition-colors duration-300"
                    size={18}
                    strokeWidth={2.5}
                  />
                  <input
                    placeholder="Nome completo para rastreio..."
                    value={details.patientName}
                    onChange={(e) => setDetails((d) => ({ ...d, patientName: e.target.value }))}
                    className={cn(inputClass, 'pl-12')}
                  />
                </div>
              </div>

              <div className="group/field relative">
                <label className={labelClass}>Tipo de PrÃ³tese</label>
                <div className="relative">
                  <Zap
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 group-focus-within/field:text-primary transition-colors duration-300"
                    size={18}
                    strokeWidth={2.5}
                  />
                  <input
                    placeholder="Ex. Protocolo, Coroa, PPR..."
                    value={details.prothesisType}
                    onChange={(e) => setDetails((d) => ({ ...d, prothesisType: e.target.value }))}
                    className={cn(inputClass, 'pl-12')}
                  />
                </div>
              </div>

              <div className="group/field relative">
                <label className={labelClass}>Material Base</label>
                <div className="relative">
                  <Landmark
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 group-focus-within/field:text-primary transition-colors duration-300"
                    size={18}
                    strokeWidth={2.5}
                  />
                  <input
                    placeholder="Ex. ZircÃ´nia, Resina, Dissilicato..."
                    value={details.material}
                    onChange={(e) => setDetails((d) => ({ ...d, material: e.target.value }))}
                    className={cn(inputClass, 'pl-12')}
                  />
                </div>
              </div>

              <div className="group/field relative">
                <label className={labelClass}>Escala de Cor</label>
                <div className="relative">
                  <Activity
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 group-focus-within/field:text-primary transition-colors duration-300"
                    size={18}
                    strokeWidth={2.5}
                  />
                  <input
                    placeholder="Ex. A1, B2, C3, Bleach-2..."
                    value={details.color}
                    onChange={(e) => setDetails((d) => ({ ...d, color: e.target.value }))}
                    className={cn(inputClass, 'pl-12')}
                  />
                </div>
              </div>

              <div className="md:col-span-2 group/field relative">
                <label className={labelClass}>Prazo de Entrega (Deadline) *</label>
                <div className="relative max-w-md">
                  <Calendar
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/40 group-focus-within/field:text-primary transition-colors duration-300"
                    size={20}
                    strokeWidth={3}
                  />
                  <input
                    type="date"
                    value={details.deadline}
                    onChange={(e) => setDetails((d) => ({ ...d, deadline: e.target.value }))}
                    className={cn(
                      inputClass,
                      'pl-16 bg-primary/5 border-primary/20 text-primary font-black text-lg focus:ring-primary/10 tracking-tight cursor-pointer',
                    )}
                  />
                </div>
              </div>

              <div className="md:col-span-2 rounded-3xl border border-border/60 bg-muted/20 p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="group/field relative">
                    <label className={labelClass}>Tipo da OS</label>
                    <select
                      value={jobSubType}
                      onChange={(event) =>
                        setJobSubType(event.target.value as 'standard' | 'proof' | 'rework')
                      }
                      className={cn(inputClass, 'cursor-pointer appearance-none')}
                    >
                      <option value="standard">Padrão</option>
                      <option value="proof">Prova</option>
                      <option value="rework">Remoldagem</option>
                    </select>
                  </div>

                  <div className="group/field relative">
                    <label className={labelClass}>Prioridade</label>
                    <button
                      type="button"
                      onClick={() => setIsUrgent((value) => !value)}
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-left text-xs font-black uppercase tracking-widest transition-all',
                        isUrgent
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : 'border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      {isUrgent ? 'Urgente (ativo)' : 'Padrão (toque para marcar urgente)'}
                    </button>
                  </div>

                  {jobSubType === 'proof' ? (
                    <div className="group/field relative">
                      <label className={labelClass}>Prazo de Retorno da Prova *</label>
                      <input
                        type="date"
                        value={proofDueDate}
                        onChange={(event) => setProofDueDate(event.target.value)}
                        className={cn(inputClass, 'cursor-pointer')}
                      />
                    </div>
                  ) : null}

                  {jobSubType === 'rework' ? (
                    <>
                      <div className="group/field relative">
                        <label className={labelClass}>OS Pai (ID) *</label>
                        <input
                          type="number"
                          min={1}
                          value={reworkParentId}
                          onChange={(event) => setReworkParentId(event.target.value)}
                          placeholder="Ex.: 1024"
                          className={cn(inputClass)}
                        />
                      </div>
                      <div className="group/field relative md:col-span-2">
                        <label className={labelClass}>Motivo da Remoldagem *</label>
                        <input
                          value={reworkReason}
                          onChange={(event) => setReworkReason(event.target.value)}
                          placeholder="Ex.: ajuste marginal e nova moldagem"
                          className={cn(inputClass)}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="md:col-span-2 group/field relative">
                <label className={labelClass}>
                  InstruÃ§Ãµes Laboratoriais / ObservaÃ§Ãµes TÃ©cnicas
                </label>
                <div className="relative">
                  <textarea
                    placeholder="Descreva detalhes anatÃ´micos, exigÃªncias estÃ©ticas ou observaÃ§Ãµes crÃ­ticas para a produÃ§Ã£o..."
                    value={details.instructions}
                    onChange={(e) => setDetails((d) => ({ ...d, instructions: e.target.value }))}
                    rows={6}
                    className={cn(inputClass, 'resize-none leading-relaxed font-medium p-6')}
                  />
                </div>
              </div>
            </div>
          </ScaleIn>
        )}

        {/* Step 3: RevisÃ£o */}
        {step === 3 && (
          <ScaleIn className="p-8 flex flex-col gap-10">
            <div className="flex items-center justify-between pb-8 border-b border-border/50 relative">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                  <ShieldCheck size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Large className="tracking-tight">RevisÃ£o e Auditoria Final</Large>
                  <Muted className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    ValidaÃ§Ã£o de faturamento e registro OS
                  </Muted>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">
              {/* Left Side: Summary Cards */}
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 rounded-[32px] bg-muted/40 border border-border/50 flex flex-col gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-8 -mt-8" />
                  <Muted className="text-[10px] font-black uppercase tracking-[0.3em] ml-1">
                    MandatÃ¡rio
                  </Muted>
                  <div className="flex items-center gap-4 relative">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-card border border-border shadow-inner font-black text-primary text-xs">
                      {selectedClient?.name.substring(0, 2).toUpperCase() || '??'}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-black text-foreground tracking-tight">
                        {selectedClient?.name}
                      </span>
                      {osNumber && (
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none">
                          OS FÃ­sica # {osNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-8 rounded-[32px] bg-muted/40 border border-border/50 flex flex-col gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-8 -mt-8" />
                  <Muted className="text-[10px] font-black uppercase tracking-[0.3em] ml-1">
                    Workflow ProduÃ§Ã£o
                  </Muted>
                  <div className="flex items-center gap-4 relative">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-card border border-border shadow-inner text-primary">
                      <Calendar size={22} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-black text-foreground tracking-tight uppercase">
                        {details.patientName || 'Paciente nÃ£o informado'}
                      </span>
                      <span className="text-[10px] font-bold text-primary tracking-widest leading-none uppercase">
                        Entrega em{' '}
                        {details.deadline
                          ? new Date(details.deadline).toLocaleDateString('pt-BR')
                          : 'Urgente'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-8 rounded-[32px] bg-primary/[0.04] border-2 border-primary/20 flex flex-col gap-6 relative shadow-2xl shadow-primary/5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl -mr-8 -mt-8" />
                  <div className="flex items-center justify-between relative">
                    <Muted className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                      ValoraÃ§Ã£o Final
                    </Muted>
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
                      <Landmark size={20} strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 relative">
                    <Large className="text-4xl font-black text-primary tracking-tighter tabular-nums leading-none">
                      {formatBRL(totalCents)}
                    </Large>
                    <Muted className="text-[9px] font-bold uppercase tracking-widest text-primary/60">
                      {items.length} ServiÃ§o(s) Composto(s)
                    </Muted>
                  </div>
                </div>
              </div>

              {/* Technical Overview Widget */}
              <div className="lg:col-span-12 p-10 rounded-[40px] bg-card border border-border/60 shadow-xl overflow-hidden group/audit relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.02] rounded-full blur-[80px] -mr-32 -mt-32" />

                <div className="flex items-center gap-4 mb-10 relative">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <Muted className="text-[10px] font-black uppercase tracking-[0.3em]">
                    ComposiÃ§Ã£o TÃ©cnica Detalhada
                  </Muted>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative items-start">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                      PrÃ³tese / Estrutura
                    </span>
                    <p className="text-xs font-black text-foreground tracking-tight leading-tight uppercase bg-muted/30 p-3 rounded-xl border border-border/40 italic">
                      {details.prothesisType || 'NÃ£o definida'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                      Material de ProduÃ§Ã£o
                    </span>
                    <p className="text-xs font-black text-foreground tracking-tight leading-tight uppercase bg-muted/30 p-3 rounded-xl border border-border/40 italic">
                      {details.material || 'NÃ£o definido'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                      ReferÃªncia CromÃ¡tica
                    </span>
                    <p className="text-xs font-black text-foreground tracking-tight leading-tight uppercase bg-muted/30 p-3 rounded-xl border border-border/40 italic">
                      {details.color || 'NÃ£o definida'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                      Ficha de InstruÃ§Ãµes
                    </span>
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 text-primary rounded-xl border border-primary/10 w-fit">
                      <Info size={12} strokeWidth={3} />
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        ContÃ©m ObservaÃ§Ãµes
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-6 bg-destructive/10 border-2 border-destructive/20 rounded-[28px] flex items-center gap-4 animate-bounce shadow-xl shadow-destructive/5">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-destructive text-white shadow-lg shadow-destructive/20">
                  <AlertCircle size={20} strokeWidth={3} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-black text-destructive uppercase tracking-widest">
                    InconsistÃªncia de Registro
                  </span>
                  <p className="text-sm font-black text-destructive tracking-tight leading-tight">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </ScaleIn>
        )}
      </div>

      {/* Global Action Bar (Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-background/80 backdrop-blur-xl border-t border-border/50 z-[100] md:static md:p-0 md:bg-transparent md:border-0 md:mt-2">
        <div className="flex gap-4 max-w-5xl mx-auto w-full">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 max-w-[160px] py-6 rounded-3xl bg-muted/40 border border-border text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted hover:text-foreground transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 group shadow-sm"
            >
              <ArrowLeft
                size={16}
                strokeWidth={3}
                className="group-hover:-translate-x-1 transition-transform"
              />{' '}
              Retroceder
            </button>
          )}
          {step < 3 ? (
            <button
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 py-6 rounded-3xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] group"
            >
              PrÃ³xima Etapa{' '}
              <ArrowRight
                size={16}
                strokeWidth={3}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          ) : (
            <button
              disabled={createMutation.isPending}
              onClick={handleSubmit}
              className="flex-1 py-6 rounded-3xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50 transition-all duration-500 flex items-center justify-center gap-3 active:scale-[0.98] group"
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" size={16} strokeWidth={3} />
              ) : (
                <Check size={18} strokeWidth={3} />
              )}
              {createMutation.isPending ? 'AUDITANDO REGISTRO...' : 'FINALIZAR E PUBLICAR OS'}
            </button>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
