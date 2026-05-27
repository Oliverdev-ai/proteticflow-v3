import { Link } from 'react-router-dom';
import { trpc } from '../../lib/trpc';

const FEATURE_LABEL: Record<'clients' | 'jobsPerMonth' | 'users' | 'priceTables', string> = {
  clients: 'clientes',
  jobsPerMonth: 'jobs no mes',
  users: 'usuarios',
  priceTables: 'tabelas de precos',
};

export function LicenseBanner() {
  const statusQuery = trpc.licensing.getStatus.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  const status = statusQuery.data;
  if (!status) return null;

  if (status.trialExpired) {
    return (
      <div className="mb-4 rounded-lg border border-[var(--destructive)] bg-[var(--destructive-soft)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--destructive)]">Trial expirado</p>
            <p className="text-xs text-[var(--destructive)] mt-1">
              Seu periodo de teste terminou. Faca upgrade para continuar criando novos registros.
            </p>
          </div>
          <Link
            to="/planos"
            className="shrink-0 rounded-md bg-[var(--destructive-soft)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--destructive-soft)]"
          >
            Ver planos
          </Link>
        </div>
      </div>
    );
  }

  const nearLimit = (Object.entries(status.usage) as Array<
    ['clients' | 'jobsPerMonth' | 'users' | 'priceTables', (typeof status.usage)[keyof typeof status.usage]]
  >).find(([, usage]) => usage.limit !== null && (usage.usagePercent ?? 0) >= 80);

  if (!nearLimit) return null;

  const [feature, usage] = nearLimit;

  return (
    <div className="mb-4 rounded-lg border border-amber-700/60 bg-amber-950/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-300">Uso proximo do limite</p>
          <p className="text-xs text-amber-200/80 mt-1">
            Voce usou {usage.current} de {usage.limit} em {FEATURE_LABEL[feature]}
            {' '}({usage.usagePercent}%).
          </p>
        </div>
        <Link
          to="/planos"
          className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-amber-400"
        >
          Fazer upgrade
        </Link>
      </div>
    </div>
  );
}
