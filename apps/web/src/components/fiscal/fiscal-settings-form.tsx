import { useEffect, useState } from 'react';
import { trpc } from '../../lib/trpc';

export function FiscalSettingsForm() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.fiscal.getFiscalSettings.useQuery();
  const upsertMutation = trpc.fiscal.upsertFiscalSettings.useMutation({
    onSuccess: async () => {
      await utils.fiscal.getFiscalSettings.invalidate();
    },
  });

  const [municipalRegistration, setMunicipalRegistration] = useState('');
  const [taxRegime, setTaxRegime] = useState<'simples' | 'lucro_presumido' | 'lucro_real'>('simples');
  const [defaultServiceCode, setDefaultServiceCode] = useState('');
  const [defaultServiceName, setDefaultServiceName] = useState('');
  const [issqnRatePercent, setIssqnRatePercent] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasSandbox, setAsaasSandbox] = useState(true);
  const [focusApiToken, setFocusApiToken] = useState('');
  const [focusSandbox, setFocusSandbox] = useState(true);

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;

    setMunicipalRegistration(data.municipalRegistration ?? '');
    setTaxRegime((data.taxRegime as 'simples' | 'lucro_presumido' | 'lucro_real' | null) ?? 'simples');
    setDefaultServiceCode(data.defaultServiceCode ?? '');
    setDefaultServiceName(data.defaultServiceName ?? '');
    setIssqnRatePercent(data.issqnRatePercent ?? '');
    setCityCode(data.cityCode ?? '');
    setAsaasSandbox(data.asaasSandbox);
    setFocusSandbox(data.focusSandbox);
  }, [settingsQuery.data]);

  async function handleSave(): Promise<void> {
    const payload: {
      municipalRegistration?: string;
      taxRegime?: 'simples' | 'lucro_presumido' | 'lucro_real';
      defaultServiceCode?: string;
      defaultServiceName?: string;
      issqnRatePercent?: string;
      cityCode?: string;
      asaasApiKey?: string;
      asaasSandbox?: boolean;
      focusApiToken?: string;
      focusSandbox?: boolean;
    } = {
      taxRegime,
      asaasSandbox,
      focusSandbox,
    };

    if (municipalRegistration.trim().length > 0) payload.municipalRegistration = municipalRegistration.trim();
    if (defaultServiceCode.trim().length > 0) payload.defaultServiceCode = defaultServiceCode.trim();
    if (defaultServiceName.trim().length > 0) payload.defaultServiceName = defaultServiceName.trim();
    if (issqnRatePercent.trim().length > 0) payload.issqnRatePercent = issqnRatePercent.trim();
    if (cityCode.trim().length > 0) payload.cityCode = cityCode.trim();
    if (asaasApiKey.trim().length > 0) payload.asaasApiKey = asaasApiKey.trim();
    if (focusApiToken.trim().length > 0) payload.focusApiToken = focusApiToken.trim();

    await upsertMutation.mutateAsync(payload);
  }

  return (
    <div className="space-y-4">
      <h4 className="text-white font-medium">Configuracao Fiscal</h4>
      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Inscricao municipal"
          value={municipalRegistration}
          onChange={(event) => setMunicipalRegistration(event.target.value)}
        />

        <select
          value={taxRegime}
          onChange={(event) => setTaxRegime(event.target.value as 'simples' | 'lucro_presumido' | 'lucro_real')}
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="simples">Simples</option>
          <option value="lucro_presumido">Lucro Presumido</option>
          <option value="lucro_real">Lucro Real</option>
        </select>

        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Codigo de servico padrao"
          value={defaultServiceCode}
          onChange={(event) => setDefaultServiceCode(event.target.value)}
        />

        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Nome de servico padrao"
          value={defaultServiceName}
          onChange={(event) => setDefaultServiceName(event.target.value)}
        />

        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Aliquota ISSQN (%)"
          value={issqnRatePercent}
          onChange={(event) => setIssqnRatePercent(event.target.value)}
        />

        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Codigo IBGE da cidade"
          value={cityCode}
          onChange={(event) => setCityCode(event.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 space-y-3">
          <p className="text-sm font-medium text-neutral-100">Asaas (Boletos)</p>
          <input
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
            placeholder="API key (opcional)"
            value={asaasApiKey}
            onChange={(event) => setAsaasApiKey(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={asaasSandbox}
              onChange={(event) => setAsaasSandbox(event.target.checked)}
            />
            Usar sandbox
          </label>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 space-y-3">
          <p className="text-sm font-medium text-neutral-100">Focus NFe (NFS-e)</p>
          <input
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Token API (opcional)"
            value={focusApiToken}
            onChange={(event) => setFocusApiToken(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={focusSandbox}
              onChange={(event) => setFocusSandbox(event.target.checked)}
            />
            Usar sandbox
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={upsertMutation.isPending}
        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
      >
        Salvar configuracao fiscal
      </button>
    </div>
  );
}
