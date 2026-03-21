import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTenantSchema } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';

type CreateTenantInput = z.infer<typeof createTenantSchema>;

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const utils = trpc.useUtils();

  const createTenant = trpc.tenant.create.useMutation({
    onSuccess: () => {
      utils.tenant.list.invalidate();
      utils.auth.getProfile.invalidate();
      setStep(2);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
  });

  const onSubmit = (data: CreateTenantInput) => {
    createTenant.mutate(data);
  };

  if (step === 2) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle2 className="text-green-400" size={56} />
          </div>
          <h1 className="text-2xl font-bold text-white">Laboratório criado!</h1>
          <p className="text-neutral-400">Tudo pronto. Vamos acessar o painel.</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Acessar o painel <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Building2 className="text-violet-400" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white">Configure seu laboratório</h1>
          <p className="text-neutral-400 text-sm">Esses dados aparecerão nos seus relatórios e PDFs.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Nome do laboratório *</label>
            <input
              {...register('name')}
              placeholder="Ex: Lab Dental Silva"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {/* CNPJ */}
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">CNPJ</label>
            <input
              {...register('cnpj')}
              placeholder="00.000.000/0001-00"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Telefone */}
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">Telefone</label>
              <input
                {...register('phone')}
                placeholder="(00) 00000-0000"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            {/* Email */}
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">Email</label>
              <input
                {...register('email')}
                placeholder="contato@lab.com"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5 flex items-center gap-1">
              <MapPin size={13} className="text-neutral-500" /> Cidade / UF
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  {...register('city')}
                  placeholder="Cidade"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <input
                  {...register('state')}
                  placeholder="UF"
                  maxLength={2}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 transition-colors uppercase"
                />
              </div>
            </div>
          </div>

          {createTenant.error && (
            <p className="text-red-400 text-sm">{createTenant.error.message}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || createTenant.isPending}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {createTenant.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <>Criar laboratório <ArrowRight size={16} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
