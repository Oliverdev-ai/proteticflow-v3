import { describe, expect, it } from 'vitest';
import { __testOnly } from './service.js';

describe('portal service helpers', () => {
  it('gera hash deterministico para o token', () => {
    const token = 'token-publico-de-teste';
    expect(__testOnly.hashToken(token)).toBe(__testOnly.hashToken(token));
  });

  it('retorna apenas campos publicos de job', () => {
    const job = {
      id: 10,
      code: 'OS-00010',
      patientName: 'Paciente A',
      prothesisType: 'Coroa',
      material: 'Ceramica',
      color: 'A1',
      status: 'in_progress',
      deadline: new Date('2026-03-30T12:00:00Z'),
      deliveredAt: null,
      totalCents: 999999,
    } as unknown as Parameters<typeof __testOnly.pickPublicJob>[0];

    const sanitized = __testOnly.pickPublicJob(job);
    expect('totalCents' in sanitized).toBe(false);
    expect(sanitized.code).toBe('OS-00010');
  });
});
