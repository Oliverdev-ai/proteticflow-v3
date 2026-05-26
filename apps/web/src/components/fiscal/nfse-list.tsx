import { formatCurrency, formatDate, INVOICE_STATUS_CHIP, type Nfse } from '@proteticflow/shared';
import { DataTable, type Column } from '../shared/data-table';
import { StatusChip } from '../shared/status-chip';

type NfseListProps = {
  notas: Nfse[];
  isBusy?: boolean;
  onSync: (nfseId: number) => void;
  onCancel: (nfseId: number) => void;
};

type NfseRow = {
  id: number;
  tomadorName: string;
  grossValueCents: number;
  status: keyof typeof INVOICE_STATUS_CHIP;
  issuedAt: string | null;
  danfseUrl: string | null;
};

function toInvoiceStatus(value: string): keyof typeof INVOICE_STATUS_CHIP {
  if (value === 'pending' || value === 'issued' || value === 'cancelled' || value === 'error') {
    return value;
  }
  return 'draft';
}

export function NfseList({ notas, isBusy = false, onSync, onCancel }: NfseListProps) {
  const rows: NfseRow[] = notas.map((nota) => ({
    id: nota.id,
    tomadorName: nota.tomadorName,
    grossValueCents: nota.grossValueCents,
    status: toInvoiceStatus(nota.status),
    issuedAt: nota.issuedAt ?? null,
    danfseUrl: nota.danfseUrl ?? null,
  }));

  const columns: Column<NfseRow>[] = [
    {
      id: 'id',
      header: 'ID',
      width: '90px',
      cell: (row) => <span className="t-mono">#{row.id}</span>,
    },
    {
      id: 'tomador',
      header: 'Tomador',
      width: 'flex',
      cell: (row) => <span className="truncate t-small">{row.tomadorName}</span>,
    },
    {
      id: 'value',
      header: 'Valor',
      width: '140px',
      align: 'right',
      cell: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.grossValueCents)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '118px',
      cell: (row) => {
        const chip = INVOICE_STATUS_CHIP[row.status];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
    {
      id: 'issuedAt',
      header: 'Emissao',
      width: '120px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{row.issuedAt ? formatDate(row.issuedAt) : '-'}</span>,
    },
    {
      id: 'actions',
      header: 'Acoes',
      width: '260px',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSync(row.id);
            }}
            disabled={isBusy}
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 text-xs text-[var(--fg)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
          >
            Sincronizar
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCancel(row.id);
            }}
            disabled={isBusy || row.status !== 'issued'}
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 text-xs text-[var(--fg)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!row.danfseUrl) return;
              window.open(row.danfseUrl, '_blank', 'noopener,noreferrer');
            }}
            disabled={isBusy || !row.danfseUrl}
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 text-xs text-[var(--fg)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
          >
            Abrir DANFSE
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getKey={(row) => row.id}
      empty={{
        title: 'Nenhuma nota fiscal encontrada',
        description: 'Ajuste os filtros para continuar.',
      }}
    />
  );
}
