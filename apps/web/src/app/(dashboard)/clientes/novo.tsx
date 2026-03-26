import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientSchema } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';

type FormData = z.infer<typeof createClientSchema>;

export default function ClientCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { priceAdjustmentPercent: 0 },
  });

  const createMutation = trpc.clientes.create.useMutation({
    onSuccess: (client) => {
      utils.client.list.invalidate();
      navigate(`/clientes/${client.id}`);
    },
  });

  // Busca CEP automática (03.02)
  const zipCode = watch('zipCode');
  const lookupQuery = trpc.clientes.lookupCep.useQuery(
    { cep: (zipCode ?? '').replace(/\D/g, '') },
    { enabled: (zipCode ?? '').replace(/\D/g, '').length === 8, retry: false }
  );

  useEffect(() => {
    if (lookupQuery.data) {
      setValue('street', lookupQuery.data.street ?? '');
      setValue('neighborhood', lookupQuery.data.neighborhood ?? '');
      setValue('city', lookupQuery.data.city ?? '');
      setValue('state', lookupQuery.data.state ?? '');
    }
  }, [lookupQuery.data, setValue]);

  const onSubmit = (data: FormData) => createMutation.mutate(data);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="text-neutral-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-white">Novo Cliente</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300">Informações gerais</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-neutral-400 mb-1.5">Nome *</label>
              <input {...register('name')} placeholder="Nome do cliente / clínica" className="input-field w-full" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Clínica / Empresa</label>
              <input {...register('clinic')} placeholder="Clínica Odonto Ltda" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Pessoa de contato</label>
              <input {...register('contactPerson')} placeholder="Dr. Carlos" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Email</label>
              <input {...register('email')} type="email" placeholder="contato@clinica.com" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Telefone</label>
              <input {...register('phone')} placeholder="(00) 00000-0000" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Telefone 2</label>
              <input {...register('phone2')} placeholder="(00) 00000-0000" className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Tipo documento</label>
              <select {...register('documentType')} className="input-field w-full">
                <option value="">Selecione</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Documento</label>
              <input {...register('document')} placeholder="000.000.000-00" className="input-field w-full" />
            </div>
          </div>
        </section>

        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-1.5">
            <MapPin size={14} className="text-neutral-500" /> Endereço
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">CEP {lookupQuery.isLoading && <Loader2 size={10} className="animate-spin inline ml-1" />}</label>
              <input {...register('zipCode')} placeholder="00000-000" className="input-field w-full" />
              {lookupQuery.error && <p className="text-orange-400 text-xs mt-1">CEP não encontrado</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-neutral-400 mb-1.5">Rua</label>
              <input {...register('street')} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Número</label>
              <input {...register('addressNumber')} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Complemento</label>
              <input {...register('complement')} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Bairro</label>
              <input {...register('neighborhood')} className="input-field w-full" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-neutral-400 mb-1.5">Cidade</label>
              <input {...register('city')} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">UF</label>
              <input {...register('state')} maxLength={2} className="input-field w-full uppercase" />
            </div>
          </div>
        </section>

        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300">Preferências comerciais</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Ajuste de preço (%)</label>
              <input {...register('priceAdjustmentPercent', { valueAsNumber: true })} type="number" step="0.01" min="-100" max="100" className="input-field w-full" />
              <p className="text-neutral-600 text-xs mt-1">Ex: -10 = desconto 10%; +5 = acréscimo 5%</p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-neutral-400 mb-1.5">Preferências técnicas</label>
              <textarea {...register('technicalPreferences')} rows={3} placeholder="Ex: Prefere zircônia, evitar metais..." className="input-field w-full resize-none" />
            </div>
          </div>
        </section>

        {createMutation.error && <p className="text-red-400 text-sm">{createMutation.error.message}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/clientes')} className="flex-1 py-3 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:bg-neutral-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting || createMutation.isPending} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {createMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Criar cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
