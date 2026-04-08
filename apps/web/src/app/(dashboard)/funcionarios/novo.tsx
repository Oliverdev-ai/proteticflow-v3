import { useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEmployeeSchema } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Loader2, User, MapPin, Briefcase, CreditCard, Percent } from 'lucide-react';
import type { z } from 'zod';

type FormData = z.input<typeof createEmployeeSchema>;

export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      type: 'protesista',
      contractType: 'clt',
      baseSalaryCents: 0,
      defaultCommissionPercent: 0,
    },
  });

  const createMutation = trpc.employee.create.useMutation({
    onSuccess: () => {
      utils.employee.list.invalidate();
      navigate('/funcionarios');
    },
  });

  const onSubmit: SubmitHandler<FormData> = (data) => createMutation.mutate(data);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/funcionarios')}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-white">Novo Funcionário</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações Pessoais */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <User size={16} className="text-primary" /> Informações Pessoais
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Nome Completo *</label>
                <input
                  {...register('name')}
                  placeholder="Nome do funcionário"
                  className="input-field w-full"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">CPF</label>
                  <input
                    {...register('cpf')}
                    placeholder="000.000.000-00"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">RG</label>
                  <input
                    {...register('rg')}
                    placeholder="00.000.000-0"
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="email@exemplo.com"
                  className="input-field w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Telefone</label>
                  <input
                    {...register('phone')}
                    placeholder="(00) 00000-0000"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Nascimento</label>
                  <input {...register('birthDate')} type="date" className="input-field w-full" />
                </div>
              </div>
            </div>
          </section>

          {/* Endereço */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <MapPin size={16} className="text-primary" /> Endereço
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs text-zinc-400 mb-1.5">CEP</label>
                  <input
                    {...register('zipCode')}
                    placeholder="00000-000"
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1.5">Rua</label>
                  <input {...register('street')} className="input-field w-full" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Número</label>
                  <input {...register('addressNumber')} className="input-field w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1.5">Bairro</label>
                  <input {...register('neighborhood')} className="input-field w-full" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs text-zinc-400 mb-1.5">Cidade</label>
                  <input {...register('city')} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">UF</label>
                  <input
                    {...register('state')}
                    maxLength={2}
                    className="input-field w-full uppercase"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Vínculo e Cargo */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Briefcase size={16} className="text-primary" /> Vínculo Empregatício
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Função / Cargo</label>
                  <input
                    {...register('position')}
                    placeholder="Ex: Protesista Sênior"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Departamento</label>
                  <input
                    {...register('department')}
                    placeholder="Ex: Produção"
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Tipo Profissional</label>
                  <select {...register('type')} className="input-field w-full">
                    <option value="protesista">Protesista</option>
                    <option value="auxiliar">Auxiliar</option>
                    <option value="recepcionista">Recepcionista</option>
                    <option value="gerente">Gerente</option>
                    <option value="proprietario">Proprietário</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Tipo Contrato</label>
                  <select {...register('contractType')} className="input-field w-full">
                    <option value="clt">CLT</option>
                    <option value="pj_mei">PJ / MEI</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="estagiario">Estagiário</option>
                    <option value="autonomo">Autônomo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Data de Admissão</label>
                <input {...register('admissionDate')} type="date" className="input-field w-full" />
              </div>
            </div>
          </section>

          {/* Remuneração e Comissão */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <CreditCard size={16} className="text-primary" /> Remuneração
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Salário Base (Cents)</label>
                <input
                  {...register('baseSalaryCents', { valueAsNumber: true })}
                  type="number"
                  className="input-field w-full"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Ex: 300000 para R$ 3.000,00</p>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 flex items-center justify-between">
                  Comissão Padrão (%)
                  <Percent size={12} className="text-zinc-500" />
                </label>
                <input
                  {...register('defaultCommissionPercent', { valueAsNumber: true })}
                  type="number"
                  step="0.1"
                  className="input-field w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Vale Transp. (Cents)</label>
                  <input
                    {...register('transportAllowanceCents', { valueAsNumber: true })}
                    type="number"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Vale Ref. (Cents)</label>
                  <input
                    {...register('mealAllowanceCents', { valueAsNumber: true })}
                    type="number"
                    className="input-field w-full"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {createMutation.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
            {createMutation.error.message}
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/funcionarios')}
            className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-800 hover:text-white transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="flex-[2] py-3 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Salvando...
              </>
            ) : (
              'Cadastrar Funcionário'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
