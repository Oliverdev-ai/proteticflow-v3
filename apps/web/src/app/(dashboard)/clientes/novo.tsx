import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientSchema } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Building2,
  Percent,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { PageTransition } from '../../../components/shared/page-transition';
import { PageTitle, Subtitle } from '../../../components/shared/typography';
import { FormError, FormField, FormSection } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';

type ClientFormInput = z.input<typeof createClientSchema>;
type ClientFormOutput = z.output<typeof createClientSchema>;

export default function ClientCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormInput, unknown, ClientFormOutput>({
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
    { enabled: zipCodeDigits.length === 8, retry: false },
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

  const controlClass =
    'w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2 text-[0.875rem] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus-visible:outline-none focus-visible:border-[var(--border-focus)] focus-visible:shadow-[var(--shadow-focus)] disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => navigate('/clientes')}
          className="w-12 h-12 flex items-center justify-center rounded-lg bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all  shadow-sm"
        >
          <ArrowLeft size={20} strokeWidth={3} />
        </button>
        <div className="flex flex-col gap-0.5">
          <PageTitle>Novo Parceiro</PageTitle>
          <Subtitle>Cadastre um novo dentista ou laboratório na sua rede</Subtitle>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Coluna Principal: Dados de Contato e Endereço */}
        <div className="md:col-span-8 flex flex-col gap-8">
          {/* Sessão 1: Informações Gerais */}
          <section className="premium-card p-6 flex flex-col gap-6">
            <FormSection
              title="Identificação"
              description="Nome e dados de identificação"
              icon={<Building2 size={20} />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input
                    label="Nome Completo / Razão Social"
                    required
                    error={errors.name?.message}
                    {...register('name')}
                    placeholder="Ex: Dr. Leandro Castro ou Clínica Odonto"
                  />
                </div>

                <Input
                  label="Clínica Responsável"
                  {...register('clinic')}
                  placeholder="Nome da empresa (opcional)"
                />
                <Input
                  label="Pessoa de Contato"
                  {...register('contactPerson')}
                  placeholder="Secretária ou Responsável"
                />

                <Input
                  label="Email Principal"
                  type="email"
                  {...register('email')}
                  placeholder="contato@exemplo.com"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="WhatsApp" {...register('phone')} placeholder="(00) 00000-0000" />
                  <Input label="Fixo" {...register('phone2')} placeholder="(00) 0000-0000" />
                </div>

                <FormField label="Tipo de Pessoa">
                  <select
                    {...register('documentType')}
                    className={cn(
                      controlClass,
                      "appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJtNiA5IDYgNiA2LTYiLz48L3N2Zz4=')] bg-[length:1.25rem_1.25rem] bg-[right_1rem_center] bg-no-repeat",
                    )}
                  >
                    <option value="">Selecione...</option>
                    <option value="cpf">PESSOA FÍSICA (CPF)</option>
                    <option value="cnpj">PESSOA JURÍDICA (CNPJ)</option>
                  </select>
                </FormField>
                <Input
                  label="Documento (CPF/CNPJ)"
                  {...register('document')}
                  placeholder="000.000.000-00"
                />
              </div>
            </FormSection>
          </section>

          {/* Sessão 2: Endereço */}
          <section className="premium-card p-6 flex flex-col gap-6">
            <FormSection
              title="Localização"
              description="Endereço de coleta e entrega"
              icon={<MapPin size={20} />}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <Input
                    label="CEP"
                    hint={
                      lookupQuery.isLoading
                        ? 'Buscando endereço...'
                        : lookupQuery.error
                          ? 'Endereço não encontrado'
                          : undefined
                    }
                    {...register('zipCode')}
                    placeholder="00000-000"
                  />
                </div>
                <div className="md:col-span-8">
                  <Input
                    label="Logradouro"
                    {...register('street')}
                    placeholder="Rua, Avenida..."
                  />
                </div>

                <div className="md:col-span-3">
                  <Input label="Número" {...register('addressNumber')} />
                </div>
                <div className="md:col-span-4">
                  <Input
                    label="Complemento"
                    {...register('complement')}
                    placeholder="Sala, Apto, Bloco"
                  />
                </div>
                <div className="md:col-span-5">
                  <Input label="Bairro" {...register('neighborhood')} />
                </div>

                <div className="md:col-span-9">
                  <Input label="Cidade" {...register('city')} />
                </div>
                <div className="md:col-span-3">
                  <Input
                    label="Estado (UF)"
                    {...register('state')}
                    maxLength={2}
                    placeholder="UF"
                    className="uppercase text-center"
                  />
                </div>
              </div>
            </FormSection>
          </section>
        </div>

        {/* Coluna Lateral: Preferências e Ações */}
        <div className="md:col-span-4 flex flex-col gap-8">
          <section className="premium-card p-6 flex flex-col gap-6 sticky top-8">
            <FormSection
              title="Comercial"
              description="Tabelas e ajustes"
              icon={<Percent size={20} />}
            >
              <div className="space-y-4">
                <Input
                  label="Ajuste Global (%)"
                  hint="Valores negativos aplicam desconto. Ex: -10 = 10% OFF automático."
                  {...register('priceAdjustmentPercent', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="-100"
                  max="100"
                />

                <FormField label="Observações Técnicas">
                  <textarea
                    {...register('technicalPreferences')}
                    rows={6}
                    placeholder="Instruções recorrentes, materiais de preferência, etc..."
                    className={cn(controlClass, 'resize-none min-h-[140px]')}
                  />
                </FormField>
              </div>
            </FormSection>

            <div className="pt-6 flex flex-col gap-3 border-t border-border/50">
              {createMutation.error ? <FormError>{createMutation.error.message}</FormError> : null}

              <button
                type="submit"
                disabled={isSubmitting || createMutation.isPending}
                className="w-full bg-primary text-primary-foreground text-xs font-semibold px-6 py-4 rounded-lg transition-all shadow-lg shadow-sm hover:brightness-110  uppercase tracking-normal flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : (
                  <ChevronRight size={16} strokeWidth={3} />
                )}
                Criar Parceiro
              </button>

              <button
                type="button"
                onClick={() => navigate('/clientes')}
                className="w-full py-4 rounded-lg bg-muted border border-border text-muted-foreground text-[10px] font-semibold uppercase tracking-normal hover:bg-muted/80 transition-all"
              >
                Cancelar Operação
              </button>
            </div>
          </section>

          {/* Social Proof Placeholder card */}
          <div className="bg-primary/5 rounded-lg border border-primary/20 p-6 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Share2 size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-normal text-primary">
                Convite Digital
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">
                Após criar o parceiro, você poderá enviar um convite para o login exclusivo dele.
              </p>
            </div>
          </div>
        </div>
      </form>
    </PageTransition>
  );
}
