import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientSchema } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Loader2, MapPin, Building2, User, Mail, Percent, ChevronRight, Share2 } from 'lucide-react';
import { PageTransition } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted } from '../../../components/shared/typography';
import { cn } from '../../../lib/utils';

type ClientFormInput = z.input<typeof createClientSchema>;
type ClientFormOutput = z.output<typeof createClientSchema>;

export default function ClientCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<ClientFormInput, unknown, ClientFormOutput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { priceAdjustmentPercent: 0 },
  });

  const createMutation = trpc.clientes.create.useMutation({
    onSuccess: (client) => {
      utils.clientes.list.invalidate();
      navigate(`/clientes/${client.id}`);
    },
  });

  const zipCode = watch('zipCode');
  const zipCodeDigits = typeof zipCode === 'string' ? zipCode.replace(/\D/g, '') : '';
  const lookupQuery = trpc.clientes.lookupCep.useQuery(
    { cep: zipCodeDigits },
    { enabled: zipCodeDigits.length === 8, retry: false }
  );

  useEffect(() => {
    if (lookupQuery.data) {
      setValue('street', lookupQuery.data.street ?? '');
      setValue('neighborhood', lookupQuery.data.neighborhood ?? '');
      setValue('city', lookupQuery.data.city ?? '');
      setValue('state', lookupQuery.data.state ?? '');
    }
  }, [lookupQuery.data, setValue]);

  const onSubmit: SubmitHandler<ClientFormOutput> = (data) => {
    const payload: ClientFormInput = {
      name: data.name,
      clinic: data.clinic,
      email: data.email,
      phone: data.phone,
      phone2: data.phone2,
      documentType: data.documentType,
      document: data.document,
      contactPerson: data.contactPerson,
      street: data.street,
      addressNumber: data.addressNumber,
      complement: data.complement,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      technicalPreferences: data.technicalPreferences,
      priceAdjustmentPercent: data.priceAdjustmentPercent,
      pricingTableId: data.pricingTableId,
    };

    createMutation.mutate(payload);
  };

  const inputClass = "w-full bg-muted border border-border rounded-xl px-4 py-2 text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all";
  const labelClass = "block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1";

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-6">
        <button 
          onClick={() => navigate('/clientes')} 
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft size={20} strokeWidth={3} />
        </button>
        <div className="flex flex-col gap-0.5">
          <H1>Novo Parceiro</H1>
          <Subtitle>Cadastre um novo dentista ou laboratório na sua rede</Subtitle>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Coluna Principal: Dados de Contato e Endereço */}
        <div className="md:col-span-8 flex flex-col gap-8">
          {/* Sessão 1: Informações Gerais */}
          <section className="premium-card p-6 flex flex-col gap-6">
            <div className="flex items-center gap-3 pb-4 border-b border-border/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Identificação</h2>
                <Muted className="text-[10px] uppercase font-bold tracking-widest">Nome e dados de identificação</Muted>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Nome Completo / Razão Social *</label>
                <div className="relative">
                   <input {...register('name')} placeholder="Ex: Dr. Leandro Castro ou Clínica Odonto" className={inputClass} />
                   <User className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={16} />
                </div>
                {errors.name && <p className="text-destructive text-[10px] font-black uppercase tracking-widest mt-2 ml-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className={labelClass}>Clínica Responsável</label>
                <input {...register('clinic')} placeholder="Nome da empresa (opcional)" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Pessoa de Contato</label>
                <input {...register('contactPerson')} placeholder="Secretária ou Responsável" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Email Principal</label>
                <div className="relative">
                  <input {...register('email')} type="email" placeholder="contato@exemplo.com" className={inputClass} />
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={16} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>WhatsApp</label>
                  <input {...register('phone')} placeholder="(00) 00000-0000" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Fixo</label>
                  <input {...register('phone2')} placeholder="(00) 0000-0000" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Tipo de Pessoa</label>
                <select {...register('documentType')} className={cn(inputClass, "appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJtNiA5IDYgNiA2LTYiLz48L3N2Zz4=')] bg-[length:1.25rem_1.25rem] bg-[right_1rem_center] bg-no-repeat")}>
                  <option value="">Selecione...</option>
                  <option value="cpf">PESSOA FÍSICA (CPF)</option>
                  <option value="cnpj">PESSOA JURÍDICA (CNPJ)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Documento (CPF/CNPJ)</label>
                <input {...register('document')} placeholder="000.000.000-00" className={inputClass} />
              </div>
            </div>
          </section>

          {/* Sessão 2: Endereço */}
          <section className="premium-card p-6 flex flex-col gap-6">
            <div className="flex items-center gap-3 pb-4 border-b border-border/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Localização</h2>
                <Muted className="text-[10px] uppercase font-bold tracking-widest">Endereço de coleta e entrega</Muted>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <label className={labelClass}>CEP {lookupQuery.isLoading && <Loader2 size={10} className="animate-spin inline ml-1 text-primary" />}</label>
                <input {...register('zipCode')} placeholder="00000-000" className={inputClass} />
                {lookupQuery.error && <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">Endereço não encontrado</p>}
              </div>
              <div className="md:col-span-8">
                <label className={labelClass}>Logradouro</label>
                <input {...register('street')} placeholder="Rua, Avenida..." className={inputClass} />
              </div>

              <div className="md:col-span-3">
                <label className={labelClass}>Número</label>
                <input {...register('addressNumber')} className={inputClass} />
              </div>
              <div className="md:col-span-4">
                <label className={labelClass}>Complemento</label>
                <input {...register('complement')} placeholder="Sala, Apto, Bloco" className={inputClass} />
              </div>
              <div className="md:col-span-5">
                <label className={labelClass}>Bairro</label>
                <input {...register('neighborhood')} className={inputClass} />
              </div>

              <div className="md:col-span-9">
                <label className={labelClass}>Cidade</label>
                <input {...register('city')} className={inputClass} />
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Estado (UF)</label>
                <input {...register('state')} maxLength={2} placeholder="UF" className={cn(inputClass, "uppercase text-center")} />
              </div>
            </div>
          </section>
        </div>

        {/* Coluna Lateral: Preferências e Ações */}
        <div className="md:col-span-4 flex flex-col gap-8">
          <section className="premium-card p-6 flex flex-col gap-6 sticky top-8">
             <div className="flex items-center gap-3 pb-4 border-b border-border/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Percent size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Comercial</h2>
                <Muted className="text-[10px] uppercase font-bold tracking-widest">Tabelas e ajustes</Muted>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Ajuste Global (%)</label>
                <div className="relative">
                   <input {...register('priceAdjustmentPercent', { valueAsNumber: true })} type="number" step="0.01" min="-100" max="100" className={cn(inputClass, "pr-12")} />
                   <div className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 bg-background border border-border rounded-lg text-xs font-black text-primary">%</div>
                </div>
                <Muted className="text-[9px] uppercase tracking-widest mt-2 leading-relaxed">
                  Valores negativos aplicam desconto. <br/>Ex: -10 = 10% OFF automático.
                </Muted>
              </div>

              <div>
                <label className={labelClass}>Observações Técnicas</label>
                <textarea 
                  {...register('technicalPreferences')} 
                  rows={6} 
                  placeholder="Instruções recorrentes, materiais de preferência, etc..." 
                  className={cn(inputClass, "resize-none min-h-[140px]")} 
                />
              </div>
            </div>

            <div className="pt-6 flex flex-col gap-3 border-t border-border/50">
              {createMutation.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-[10px] font-black uppercase tracking-widest text-center">
                  {createMutation.error.message}
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isSubmitting || createMutation.isPending} 
                className="w-full bg-primary text-primary-foreground text-xs font-black px-6 py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 uppercase tracking-[0.2em] flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><ChevronRight size={16} strokeWidth={3} /> Criar Parceiro</>}
              </button>
              
              <button 
                type="button" 
                onClick={() => navigate('/clientes')} 
                className="w-full py-4 rounded-2xl bg-muted border border-border text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted/80 transition-all"
              >
                Cancelar Operação
              </button>
            </div>
          </section>

          {/* Social Proof Placeholder card */}
          <div className="bg-primary/5 rounded-[32px] border border-primary/20 p-6 flex flex-col items-center gap-4 text-center">
             <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <Share2 size={24} />
             </div>
             <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-widest text-primary">Convite Digital</p>
                <p className="text-[10px] text-muted-foreground font-medium">Após criar o parceiro, você poderá enviar um convite para o login exclusivo dele.</p>
             </div>
          </div>
        </div>
      </form>
    </PageTransition>
  );
}
