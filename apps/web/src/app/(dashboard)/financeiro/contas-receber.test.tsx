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
      useUtils: () => ({ financial: { listAr: { invalidate: vi.fn() } } }),
      financial: {
        listAr: {
          useQuery: () => ({
            data: {
              data: [
                {
                  ar: {
                    id: 101,
                    jobId: 202,
                    amountCents: 12345,
                    dueDate: '2026-07-20T00:00:00.000Z',
                    status: 'pending',
                  },
                  clientName: 'Clinica Norte',
                },
              ],
            },
            isLoading: false,
          }),
        },
        markArPaid: { useMutation: () => ({ mutate, isPending: false }) },
        cancelAr: { useMutation: () => ({ mutate, isPending: false }) },
      },
    },
  };
});

import ContasReceberPage from './contas-receber';

function renderForRole(role: Role): string {
  authState.role = role;
  return renderToString(
    <MemoryRouter>
      <ContasReceberPage />
    </MemoryRouter>,
  );
}

describe('ContasReceberPage role guards', () => {
  it('renders operational and destructive CTAs for gerente', () => {
    const html = renderForRole('gerente');
    expect(html).toContain('Liquidar');
    expect(html).toContain('Cancelar título');
  });

  it('renders only operational CTA for contabil', () => {
    const html = renderForRole('contabil');
    expect(html).toContain('Liquidar');
    expect(html).not.toContain('Cancelar título');
  });

  it('hides financial CTAs for producao and recepcao', () => {
    const producao = renderForRole('producao');
    const recepcao = renderForRole('recepcao');
    expect(producao).not.toContain('Liquidar');
    expect(producao).not.toContain('Cancelar título');
    expect(recepcao).not.toContain('Liquidar');
    expect(recepcao).not.toContain('Cancelar título');
  });
});
