import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTable, getNextSort, runRowClickByKey } from './data-table';
import type { Column } from './types';

interface DemoRow {
  id: string;
  name: string;
}

const columns: Column<DemoRow>[] = [
  {
    id: 'name',
    header: 'Nome',
    cell: (row) => row.name,
    sortable: true,
  },
];

describe('DataTable', () => {
  it('renderiza linhas quando existem dados', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={columns}
        rows={[{ id: '1', name: 'Ana' }]}
        getKey={(row) => row.id}
        sort={{ id: 'name', dir: 'asc' }}
        onSortChange={() => undefined}
      />,
    );

    expect(html).toContain('Ana');
    expect(html).toContain('Nome');
  });

  it('renderiza empty state padrao quando rows vazio', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={columns}
        rows={[]}
        getKey={(row) => row.id}
        sort={{ id: 'name', dir: 'asc' }}
        onSortChange={() => undefined}
      />,
    );

    expect(html).toContain('Nenhum registro');
  });

  it('calcula proximo sort para callback controlado', () => {
    const onSortChange = vi.fn();
    onSortChange(getNextSort({ id: 'name', dir: 'asc' }, 'name'));

    expect(onSortChange).toHaveBeenCalledWith({ id: 'name', dir: 'desc' });
  });

  it('dispara callback de click por teclado quando Enter', () => {
    const onRowClick = vi.fn();
    const row: DemoRow = { id: '1', name: 'Ana' };
    const preventDefault = vi.fn();

    runRowClickByKey({ key: 'Enter', preventDefault }, row, onRowClick);

    expect(preventDefault).toHaveBeenCalled();
    expect(onRowClick).toHaveBeenCalledWith(row);
  });
});
