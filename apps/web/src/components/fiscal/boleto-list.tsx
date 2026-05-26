import { formatCurrency, formatDate, BOLETO_STATUS_CHIP, type Boleto } from '@proteticflow/shared';
import { DataTable, type Column } from '../shared/data-table';
import { StatusChip } from '../shared/status-chip';
import { BoletoActions } from './boleto-actions';

type BoletoListProps = {
  boletos: Boleto[];
  isBusy?: boolean;
  onSync: (boletoId: number) => void;
  onCancel: (boletoId: number) => void;
};

type BoletoRow = {
  id: number;
  amountCents: number;
  dueDate: string;
  status: keyof typeof BOLETO_STATUS_CHIP;
  boleto: Boleto;
};

function toBoletoStatus(value: string): keyof typeof BOLETO_STATUS_CHIP {
  if (value === 'paid' || value === 'overdue' || value === 'cancelled' || value === 'refunded') {
    return value;
  }
  return 'pending';
}

export function BoletoList({ boletos, isBusy = false, onSync, onCancel }: BoletoListProps) {
  const rows: BoletoRow[] = boletos.map((boleto) => ({
    id: boleto.id,
    amountCents: boleto.amountCents,
    dueDate: boleto.dueDate,
    status: toBoletoStatus(boleto.status),
    boleto,
  }));

  const columns: Column<BoletoRow>[] = [
    {
      id: 'id',
      header: 'ID',
      width: '90px',
      cell: (row) => <span className="t-mono">#{row.id}</span>,
    },
    {
      id: 'amount',
      header: 'Valor',
      width: '130px',
      align: 'right',
      cell: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.amountCents)}</span>,
    },
    {
      id: 'dueDate',
      header: 'Vencimento',
      width: '130px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{formatDate(row.dueDate)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '118px',
      cell: (row) => {
        const chip = BOLETO_STATUS_CHIP[row.status];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
    {
      id: 'actions',
      header: 'Acoes',
      width: '250px',
      align: 'right',
      cell: (row) => (
        <div onClick={(event) => event.stopPropagation()}>
          <BoletoActions boleto={row.boleto} isBusy={isBusy} onSync={onSync} onCancel={onCancel} />
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
        title: 'Nenhum boleto encontrado',
        description: 'Ajuste os filtros para continuar.',
      }}
    />
  );
}
