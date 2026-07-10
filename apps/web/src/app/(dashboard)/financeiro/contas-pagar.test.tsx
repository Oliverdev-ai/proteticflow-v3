import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@proteticflow/shared';

const authState = vi.hoisted(() => ({ role: 'gerente' as Role }));

vi.mock('../../../hooks/use-permissions', () => ({
  usePermissions: () => ({
    role: authState.role,
    modules: [],
    hasAccess: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('../../../lib/trpc', () => {
  const mutate = vi.fn();
  return {
    trpc: {
      useUtils: () => ({ financial: { listAp: { invalidate: vi.fn() } } }),
      financial: {
        listAp: {
          useQuery: () => ({
            data: {
              data: [
                {
                  id: 301,
                  description: 'Fornecedor Alfa',
                  supplier: 'Alfa Dental',
                  amountCents: 67890,
                  dueDate: '2026-07-22T00:00:00.000Z',
                  status: 'pending',
                },
              ],
            },
            isLoading: false,
          }),
        },
        createAp: { useMutation: () => ({ mutate, isPending: false }) },
        markApPaid: { useMutation: () => ({ mutate, isPending: false }) },
        cancelAp: { useMutation: () => ({ mutate, isPending: false }) },
      },
    },
  };
});

import ContasPagarPage from './contas-pagar';

function renderForRole(role: Role): string {
  authState.role = role;
  return renderToString(
    <MemoryRouter>
      <ContasPagarPage />
    </MemoryRouter>,
  );
}

describe('ContasPagarPage role guards', () => {
  it('renders operational and destructive CTAs for gerente', () => {
    const html = renderForRole('gerente');
    expect(html).toContain('Registrar Despesa');
    expect(html).toContain('Quitar');
    expect(html).toContain('Anular despesa');
  });

  it('renders only operational CTAs for contabil', () => {
    const html = renderForRole('contabil');
    expect(html).toContain('Registrar Despesa');
    expect(html).toContain('Quitar');
    expect(html).not.toContain('Anular despesa');
  });

  it('hides financial CTAs for producao and recepcao', () => {
    const producao = renderForRole('producao');
    const recepcao = renderForRole('recepcao');
    expect(producao).not.toContain('Registrar Despesa');
    expect(producao).not.toContain('Quitar');
    expect(producao).not.toContain('Anular despesa');
    expect(recepcao).not.toContain('Registrar Despesa');
    expect(recepcao).not.toContain('Quitar');
    expect(recepcao).not.toContain('Anular despesa');
  });
});
