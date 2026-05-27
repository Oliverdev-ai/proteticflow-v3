import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { JOB_STATUS_CHIP, type JobStatus } from '@proteticflow/shared';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { StatusChip } from '../shared/status-chip';

type CommandSearchProps = {
  query: string;
  onSelect: () => void;
};

const JOB_STATUS_VALUES = new Set<JobStatus>([
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'rework_in_progress',
  'suspended',
  'delivered',
  'cancelled',
]);

function toJobStatus(status: string): JobStatus | null {
  return JOB_STATUS_VALUES.has(status as JobStatus) ? (status as JobStatus) : null;
}

function formatClientType(documentType: 'cpf' | 'cnpj' | null): string {
  if (documentType === 'cpf') return 'Pessoa fisica';
  if (documentType === 'cnpj') return 'Pessoa juridica';
  return 'Tipo nao informado';
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

const COMMAND_ITEM_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-sm text-[var(--fg)] data-[selected=true]:text-[var(--primary)] data-[selected=true]:ring-1 data-[selected=true]:ring-[var(--primary)]';

export function CommandSearchResults({ query, onSelect }: CommandSearchProps) {
  const navigate = useNavigate();
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const searchEnabled = debouncedQuery.length >= 2;

  const clientsQuery = trpc.clientes.search.useQuery(
    { q: debouncedQuery, limit: 5 },
    { enabled: searchEnabled },
  );
  const jobsQuery = trpc.job.search.useQuery(
    { q: debouncedQuery, limit: 5 },
    { enabled: searchEnabled },
  );

  if (!searchEnabled) return null;

  const clientResults = clientsQuery.data ?? [];
  const jobResults = jobsQuery.data ?? [];
  const isLoading = clientsQuery.isFetching || jobsQuery.isFetching;
  const hasResults = clientResults.length > 0 || jobResults.length > 0;

  return (
    <>
      <Command.Separator className="my-1 h-px bg-[var(--border)]" />

      <Command.Group heading="Busca Dinamica">
        {isLoading ? (
          <Command.Loading className="px-2 py-2 t-small text-[var(--fg-muted)]">
            Buscando...
          </Command.Loading>
        ) : null}

        {!isLoading && !hasResults ? (
          <div className="px-2 py-2 t-small text-[var(--fg-muted)]">
            Nenhum resultado para "{debouncedQuery}".
          </div>
        ) : null}

        {clientResults.map((client) => (
          <Command.Item
            key={`client-${client.id}`}
            value={`cliente-${client.name}`}
            className={COMMAND_ITEM_CLASS}
            onSelect={() => {
              navigate(`/clientes/${client.id}`);
              onSelect();
            }}
          >
            <span className="flex-1">
              <span className="block">{client.name}</span>
              <span className="t-small text-[var(--fg-muted)]">
                {formatClientType(client.documentType)}
              </span>
            </span>
          </Command.Item>
        ))}

        {jobResults.map((job) => {
          const safeStatus = toJobStatus(job.status);
          return (
            <Command.Item
              key={`job-${job.id}`}
              value={`trabalho-${job.code}`}
              className={COMMAND_ITEM_CLASS}
              onSelect={() => {
                navigate(`/trabalhos/${job.id}`);
                onSelect();
              }}
            >
              <span className="flex-1">
                <span className="block font-medium">{job.code}</span>
                <span className="t-small text-[var(--fg-muted)]">{job.clientName ?? 'Cliente nao informado'}</span>
              </span>
              {safeStatus ? (
                <StatusChip
                  label={JOB_STATUS_CHIP[safeStatus].label}
                  variant={JOB_STATUS_CHIP[safeStatus].variant}
                />
              ) : (
                <StatusChip label={job.status} variant="neutral" />
              )}
            </Command.Item>
          );
        })}
      </Command.Group>
    </>
  );
}
