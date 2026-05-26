import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './data-table';
import type { Column, DataTableProps, DataTableSort } from './types';

interface JobRow {
  id: string;
  os: string;
  client: string;
  amount: string;
}

const rows: JobRow[] = [
  { id: '1', os: 'OS-2026-001', client: 'Clínica Aurora', amount: 'R$ 320,00' },
  { id: '2', os: 'OS-2026-002', client: 'Clínica Delta', amount: 'R$ 280,00' },
  { id: '3', os: 'OS-2026-003', client: 'Odonto Central', amount: 'R$ 410,00' },
];

const columns: Column<JobRow>[] = [
  {
    id: 'os',
    header: 'OS',
    cell: (row) => <span className="t-mono">{row.os}</span>,
    sortable: true,
    width: '180px',
  },
  {
    id: 'client',
    header: 'Cliente',
    cell: (row) => row.client,
    sortable: true,
  },
  {
    id: 'amount',
    header: 'Valor',
    cell: (row) => <span className="t-money">{row.amount}</span>,
    align: 'right',
    hideBelow: 'md',
    width: '140px',
  },
];

function JobDataTable(props: DataTableProps<JobRow>) {
  return <DataTable<JobRow> {...props} />;
}

const meta: Meta<typeof JobDataTable> = {
  title: 'Shared/DataTable',
  component: JobDataTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof JobDataTable>;

export const Default: Story = {
  render: () => (
    <DataTable
      columns={columns}
      rows={rows}
      getKey={(row) => row.id}
      sort={{ id: 'os', dir: 'asc' }}
      onSortChange={() => undefined}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <DataTable
      columns={columns}
      rows={[]}
      getKey={(row) => row.id}
      loading
      sort={{ id: 'os', dir: 'asc' }}
      onSortChange={() => undefined}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      columns={columns}
      rows={[]}
      getKey={(row) => row.id}
      empty={{
        title: 'Sem trabalhos cadastrados',
        description: 'Aplique filtros diferentes ou crie uma nova OS.',
      }}
      sort={{ id: 'os', dir: 'asc' }}
      onSortChange={() => undefined}
    />
  ),
};

export const SortControlled: Story = {
  render: () => {
    const [sort, setSort] = useState<DataTableSort>({ id: 'os', dir: 'asc' });

    const sortedRows = useMemo(() => {
      const draft = [...rows];
      draft.sort((a, b) => {
        const aValue = String(a[sort.id as keyof JobRow]);
        const bValue = String(b[sort.id as keyof JobRow]);
        if (aValue === bValue) return 0;

        const comparison = aValue.localeCompare(bValue, 'pt-BR');
        return sort.dir === 'asc' ? comparison : -comparison;
      });

      return draft;
    }, [sort]);

    return (
      <DataTable
        columns={columns}
        rows={sortedRows}
        getKey={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
        density="compact"
      />
    );
  },
};
