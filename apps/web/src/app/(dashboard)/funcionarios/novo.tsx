import { useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEmployeeSchema } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Loader2, User, MapPin, Briefcase, CreditCard } from 'lucide-react';
import type { z } from 'zod';
import { FORM_SELECT_CLASS, FormError, FormField } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';

type FormData = z.input<typeof createEmployeeSchema>;

function dateInputToIso(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

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
          className="text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-white">Novo Funcionário</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações Pessoais */}
          <section className="bg-muted border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <User size={16} className="text-primary" /> Informações Pessoais
            </h2>
            <div className="space-y-3">
              <Input
                label="Nome Completo"
                required
                error={errors.name?.message}
                {...register('name')}
                placeholder="Nome do funcionário"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input label="CPF" {...register('cpf')} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Input label="RG" {...register('rg')} placeholder="00.000.000-0" />
                </div>
              </div>
              <Input
                label="Email"
                {...register('email')}
                type="email"
                placeholder="email@exemplo.com"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input label="Telefone" {...register('phone')} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Input
                    label="Nascimento"
                    {...register('birthDate', {
                      setValueAs: dateInputToIso,
                    })}
                    type="date"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Endereço */}
          <section className="bg-muted border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <MapPin size={16} className="text-primary" /> Endereço
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Input label="CEP" {...register('zipCode')} placeholder="00000-000" />
                </div>
                <div className="col-span-2">
                  <Input label="Rua" {...register('street')} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Input label="Número" {...register('addressNumber')} />
                </div>
                <div className="col-span-2">
                  <Input label="Bairro" {...register('neighborhood')} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <Input label="Cidade" {...register('city')} />
                </div>
                <div>
                  <Input label="UF" {...register('state')} maxLength={2} className="uppercase" />
                </div>
              </div>
            </div>
          </section>

          {/* Vínculo e Cargo */}
          <section className="bg-muted border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Briefcase size={16} className="text-primary" /> Vínculo Empregatício
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    label="Função / Cargo"
                    {...register('position')}
                    placeholder="Ex: Protesista Sênior"
                  />
                </div>
                <div>
                  <Input
                    label="Departamento"
                    {...register('department')}
                    placeholder="Ex: Produção"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormField label="Tipo Profissional">
                    <select {...register('type')} className={FORM_SELECT_CLASS}>
                      <option value="protesista">Protesista</option>
                      <option value="auxiliar">Auxiliar</option>
                      <option value="recepcionista">Recepcionista</option>
                      <option value="gerente">Gerente</option>
                      <option value="proprietario">Proprietário</option>
                      <option value="outro">Outro</option>
                    </select>
                  </FormField>
                </div>
                <div>
                  <FormField label="Tipo Contrato">
                    <select {...register('contractType')} className={FORM_SELECT_CLASS}>
                      <option value="clt">CLT</option>
                      <option value="pj_mei">PJ / MEI</option>
                      <option value="freelancer">Freelancer</option>
                      <option value="estagiario">Estagiário</option>
                      <option value="autonomo">Autônomo</option>
                    </select>
                  </FormField>
                </div>
              </div>
              <Input
                label="Data de Admissão"
                {...register('admissionDate', {
                  setValueAs: dateInputToIso,
                })}
                type="date"
              />
            </div>
          </section>

          {/* Remuneração e Comissão */}
          <section className="bg-muted border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <CreditCard size={16} className="text-primary" /> Remuneração
            </h2>
            <div className="space-y-3">
              <Input
                label="Salário Base (Cents)"
                hint="Ex: 300000 para R$ 3.000,00"
                {...register('baseSalaryCents', { valueAsNumber: true })}
                type="number"
              />
              <Input
                label="Comissão Padrão (%)"
                {...register('defaultCommissionPercent', { valueAsNumber: true })}
                type="number"
                step="0.1"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    label="Vale Transp. (Cents)"
                    {...register('transportAllowanceCents', { valueAsNumber: true })}
                    type="number"
                  />
                </div>
                <div>
                  <Input
                    label="Vale Ref. (Cents)"
                    {...register('mealAllowanceCents', { valueAsNumber: true })}
                    type="number"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {createMutation.error ? <FormError>{createMutation.error.message}</FormError> : null}

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/funcionarios')}
            className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-muted hover:text-white transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="flex-[2] py-3 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sm"
          >
            {createMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : null}
            Cadastrar Funcionário
          </button>
        </div>
      </form>
    </div>
  );
}
