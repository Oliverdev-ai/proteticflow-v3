import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { db } from '../../db/index.js';
import { resolveClientByName } from './resolvers.js';

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

type ClientRow = {
  id: number;
  name: string;
  pricingTableId: number | null;
  clinic: string | null;
  phone: string | null;
};

function mockClientMatches(rows: ClientRow[]) {
  (db.select as Mock).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

describe('resolveClientByName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna not_found quando nao ha matches', async () => {
    mockClientMatches([]);

    const result = await resolveClientByName(1, 'Cliente Inexistente');
    expect(result).toEqual({ status: 'not_found' });
  });

  it('retorna resolved quando ha um unico match', async () => {
    mockClientMatches([
      { id: 10, name: 'Dra Camila', pricingTableId: 4, clinic: 'Clinica Centro', phone: '11900000000' },
    ]);

    const result = await resolveClientByName(1, 'Camila');
    expect(result).toEqual({
      status: 'resolved',
      client: {
        id: 10,
        name: 'Dra Camila',
        pricingTableId: 4,
      },
    });
  });

  it('retorna ambiguous quando ha multiplos matches parciais', async () => {
    mockClientMatches([
      { id: 21, name: 'Dr Antonio Souza', pricingTableId: null, clinic: null, phone: '11911111111' },
      { id: 22, name: 'Dr Antonio Lima', pricingTableId: 7, clinic: 'Clinica Sul', phone: null },
    ]);

    const result = await resolveClientByName(1, 'Antonio');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates).toEqual([
        { id: 21, name: 'Dr Antonio Souza', clinic: null, phone: '11911111111' },
        { id: 22, name: 'Dr Antonio Lima', clinic: 'Clinica Sul', phone: null },
      ]);
    }
  });

  it('prioriza match exato quando existe um nome identico', async () => {
    mockClientMatches([
      { id: 30, name: 'Dr Marcos', pricingTableId: 3, clinic: null, phone: null },
      { id: 31, name: 'Dr Marcos Junior', pricingTableId: 3, clinic: null, phone: null },
    ]);

    const result = await resolveClientByName(1, 'Dr Marcos');
    expect(result).toEqual({
      status: 'resolved',
      client: {
        id: 30,
        name: 'Dr Marcos',
        pricingTableId: 3,
      },
    });
  });
});
