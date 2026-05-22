import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTable } from './data-table';
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

function isReactElement(node: ReactNode): node is ReactElement<Record<string, unknown>> {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node;
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }

  if (!isReactElement(node)) {
    return null;
  }

  if (predicate(node)) {
    return node;
  }

  return findElement((node.props as { children?: ReactNode }).children, predicate);
}

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

  it('renderiza skeleton rows quando loading=true', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={columns}
        rows={[]}
        getKey={(row) => row.id}
        loading
        loadingRows={3}
        sort={{ id: 'name', dir: 'asc' }}
        onSortChange={() => undefined}
      />,
    );

    const skeletonCount = (html.match(/h-4 w-full/g) ?? []).length;
    expect(skeletonCount).toBe(3);
  });

  it('chama onSortChange ao clicar no header sortable', () => {
    const onSortChange = vi.fn();
    const tree = DataTable<DemoRow>({
      columns,
      rows: [{ id: '1', name: 'Ana' }],
      getKey: (row) => row.id,
      sort: { id: 'name', dir: 'asc' },
      onSortChange,
    });
    const sortButton = findElement(
      tree,
      (element) => element.type === 'button' && typeof element.props.onClick === 'function',
    );

    expect(sortButton).not.toBeNull();
    (sortButton?.props.onClick as (() => void) | undefined)?.();
    expect(onSortChange).toHaveBeenCalledWith({ id: 'name', dir: 'desc' });
  });

  it('dispara onRowClick ao clicar em linha clicavel', () => {
    const onRowClick = vi.fn();
    const row: DemoRow = { id: '1', name: 'Ana' };
    const tree = DataTable<DemoRow>({
      columns,
      rows: [row],
      getKey: (value) => value.id,
      onRowClick,
      sort: { id: 'name', dir: 'asc' },
      onSortChange: () => undefined,
    });
    const clickableRow = findElement(
      tree,
      (element) =>
        element.type === 'tr'
        && element.props.role === 'button'
        && typeof element.props.onClick === 'function',
    );

    expect(clickableRow).not.toBeNull();
    (clickableRow?.props.onClick as (() => void) | undefined)?.();
    expect(onRowClick).toHaveBeenCalledWith(row);
  });
});
