import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import {
  Users,
  Search,
  Plus,
  ChevronLeft,
  Mail,
  Phone,
  FileText,
  User,
  Building2,
  X,
  Loader2,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', cnpj: '', email: '', phone: '', contact: '' });
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.inventory.listSuppliers.useQuery({
    search: search || undefined,
    page: 1,
    limit: 50,
  });
  const createSupplier = trpc.inventory.createSupplier.useMutation({
    onSuccess: () => {
      utils.inventory.listSuppliers.invalidate();
      setCreateOpen(false);
      setForm({ name: '', cnpj: '', email: '', phone: '', contact: '' });
    },
  });
  const toggleSupplier = trpc.inventory.toggleSupplier.useMutation({
    onSuccess: () => utils.inventory.listSuppliers.invalidate(),
  });

  const suppliers = data?.data ?? [];

  const inputClass =
    'w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all';
  const labelClass =
    'block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1';

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-5xl mx-auto pb-12">
      {/* Header Area */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link
            to="/estoque"
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={3} />
          </Link>
          <div className="flex flex-col gap-0.5">
            <H1 className="tracking-tight">Fornecedores</H1>
            <Subtitle>Gerenciamento da base de suprimentos e parcerias</Subtitle>
          </div>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-3 px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95"
        >
          <Plus size={16} strokeWidth={3} /> Novo Fornecedor
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, CNPJ ou e-mail..."
          className={cn(inputClass, 'pl-12 bg-card/50 backdrop-blur-sm border-border/50')}
        />
      </div>

      {/* Suppliers Grid/List */}
      <ScaleIn className="space-y-4">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Users className="animate-pulse text-primary/20" size={48} />
            <Muted className="animate-pulse font-black uppercase tracking-[0.2em]">
              Buscando parceiros comerciais...
            </Muted>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Users}
              title="Nenhum fornecedor cadastrado"
              description="Sua busca não retornou resultados ou você ainda não cadastrou fornecedores."
            >
              <button
                onClick={() => setSearch('')}
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                Limpar busca
              </button>
            </EmptyState>
          </div>
        ) : (
          suppliers.map((s) => (
            <div
              key={s.id}
              className={cn(
                'premium-card px-6 py-5 flex flex-wrap items-center justify-between gap-4 group transition-all',
                !s.isActive && 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100',
              )}
            >
              <div className="flex items-center gap-5">
                <div
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner',
                    s.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Building2 size={24} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-black text-foreground tracking-tight">{s.name}</p>
                  <div className="flex flex-wrap gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {s.cnpj && (
                      <span className="flex items-center gap-1.5">
                        <FileText size={12} className="opacity-40" /> {s.cnpj}
                      </span>
                    )}
                    {s.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail size={12} className="opacity-40" /> {s.email}
                      </span>
                    )}
                    {s.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone size={12} className="opacity-40" /> {s.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {s.isActive ? (
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full">
                    Ativo
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 bg-muted text-muted-foreground border border-border rounded-full">
                    Inativo
                  </span>
                )}

                <button
                  onClick={() => toggleSupplier.mutate({ id: s.id })}
                  className={cn(
                    'w-12 h-12 flex items-center justify-center rounded-2xl transition-all active:scale-90 border',
                    s.isActive
                      ? 'bg-primary/5 text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/40',
                  )}
                  title={s.isActive ? 'Desativar parceiro' : 'Ativar parceiro'}
                >
                  <ChevronRight
                    size={20}
                    strokeWidth={3}
                    className={cn('transition-transform', s.isActive && 'rotate-90')}
                  />
                </button>
              </div>
            </div>
          ))
        )}
      </ScaleIn>

      {/* Premium Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <ScaleIn className="w-full max-w-xl">
            <div className="premium-card p-10 flex flex-col gap-10 relative shadow-2xl border-primary/20 overflow-hidden">
              {/* Accent decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />

              <div className="flex justify-between items-start relative">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <Plus size={24} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <H1 className="text-2xl tracking-tighter">Novo Fornecedor</H1>
                    <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                      Cadastro de parceiro comercial
                    </Muted>
                  </div>
                </div>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-90"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <div className="md:col-span-2">
                  <label className={labelClass}>Razão Social / Nome Fantasia *</label>
                  <div className="relative">
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: LabDental Furnitures S.A."
                      className={inputClass}
                    />
                    <Building2
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                      size={18}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>CNPJ (Opcional)</label>
                  <div className="relative">
                    <input
                      value={form.cnpj}
                      onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                      placeholder="00.000.000/0000-00"
                      className={inputClass}
                    />
                    <FileText
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                      size={18}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Responsável Direto</label>
                  <div className="relative">
                    <input
                      value={form.contact}
                      onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                      placeholder="Nome do consultor"
                      className={inputClass}
                    />
                    <User
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                      size={18}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>E-mail Comercial</label>
                    <div className="relative">
                      <input
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="vendas@empresa.com"
                        className={inputClass}
                      />
                      <Mail
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                        size={18}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>WhatsApp / Fixo</label>
                    <div className="relative">
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="(11) 90000-0000"
                        className={inputClass}
                      />
                      <Phone
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                        size={18}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 mt-4 border-t border-border/50 relative">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 py-5 rounded-2xl bg-muted border border-border text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all active:scale-95"
                >
                  Descartar
                </button>
                <button
                  onClick={() =>
                    createSupplier.mutate({
                      name: form.name,
                      cnpj: form.cnpj || undefined,
                      email: form.email || undefined,
                      phone: form.phone || undefined,
                      contact: form.contact || undefined,
                    })
                  }
                  disabled={!form.name.trim() || createSupplier.isPending}
                  className="flex-[1.5] py-5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                >
                  {createSupplier.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} strokeWidth={3} /> Salvar Fornecedor
                    </>
                  )}
                </button>
              </div>
            </div>
          </ScaleIn>
        </div>
      )}
    </PageTransition>
  );
}
