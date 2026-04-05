import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, MapPin, Users, Wrench } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTenantSchema } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';

type CreateTenantFormInput = z.input<typeof createTenantSchema>;
type CreateTenantInput = z.output<typeof createTenantSchema>;
type Step = 1 | 2 | 3 | 4;

function StepBadge({ current }: { current: Step }) {
  const steps = [
    { id: 1, label: 'Laboratorio' },
    { id: 2, label: 'Primeiro cliente' },
    { id: 3, label: 'Primeira OS' },
    { id: 4, label: 'Concluir' },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
              step.id <= current ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {step.id}
          </div>
          <span className={`text-xs ${step.id === current ? 'text-white' : 'text-zinc-500'}`}>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const utils = trpc.useUtils();

  const createTenant = trpc.tenant.create.useMutation({
    onSuccess: () => {
      void utils.tenant.list.invalidate();
      void utils.auth.getProfile.invalidate();
      setStep(2);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTenantFormInput, unknown, CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
  });

  const onSubmit = (data: CreateTenantInput) => createTenant.mutate({
    name: data.name,
    cnpj: data.cnpj,
    phone: data.phone,
    email: data.email,
    address: data.address,
    city: data.city,
    state: data.state,
  });

  if (step === 2) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <StepBadge current={step} />
          <div className="flex justify-center">
            <Users className="text-primary" size={48} />
          </div>
          <h1 className="text-2xl font-bold text-white">Passo 2: cadastre seu primeiro cliente</h1>
          <p className="text-zinc-400">
            Criar o primeiro cliente garante que a equipe ja consiga emitir OS sem retrabalho.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/clientes/novo')}
              className="w-full bg-primary hover:bg-primary text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              Ir para cadastro de cliente
            </button>
            <button
              onClick={() => setStep(3)}
              className="w-full border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              Continuar onboarding
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <StepBadge current={step} />
          <div className="flex justify-center">
            <Wrench className="text-primary" size={48} />
          </div>
          <h1 className="text-2xl font-bold text-white">Passo 3: gere sua primeira OS</h1>
          <p className="text-zinc-400">
            Com cliente e OS cadastrados, o Kanban, financeiro e relatorios passam a refletir seu fluxo real.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/trabalhos/novo')}
              className="w-full bg-primary hover:bg-primary text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              Ir para criacao de OS
            </button>
            <button
              onClick={() => setStep(4)}
              className="w-full border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              Finalizar onboarding
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <StepBadge current={step} />
          <div className="flex justify-center">
            <CheckCircle2 className="text-green-400" size={56} />
          </div>
          <h1 className="text-2xl font-bold text-white">Onboarding concluido</h1>
          <p className="text-zinc-400">Tudo pronto para operar seu laboratorio no painel principal.</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-primary hover:bg-primary text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Acessar o painel <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <StepBadge current={step} />
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Building2 className="text-primary" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white">Configure seu laboratorio</h1>
          <p className="text-zinc-400 text-sm">Esses dados aparecem em relatorios, PDFs e comunicacao com clientes.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Nome do laboratorio *</label>
            <input
              {...register('name')}
              placeholder="Ex: Lab Dental Silva"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-primary transition-colors"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">CNPJ</label>
            <input
              {...register('cnpj')}
              placeholder="00.000.000/0001-00"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Telefone</label>
              <input
                {...register('phone')}
                placeholder="(00) 00000-0000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Email</label>
              <input
                {...register('email')}
                placeholder="contato@lab.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5 flex items-center gap-1">
              <MapPin size={13} className="text-zinc-500" /> Cidade / UF
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  {...register('city')}
                  placeholder="Cidade"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <input
                  {...register('state')}
                  placeholder="UF"
                  maxLength={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-primary transition-colors uppercase"
                />
              </div>
            </div>
          </div>

          {createTenant.error && <p className="text-red-400 text-sm">{createTenant.error.message}</p>}

          <button
            type="submit"
            disabled={isSubmitting || createTenant.isPending}
            className="w-full bg-primary hover:bg-primary disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {createTenant.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <>
                Criar laboratorio <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
