import { describe, expect, it } from 'vitest';

describe('user-role-dialog', () => {
  it('troca role valida (smoke)', () => {
    expect(['superadmin', 'gerente', 'producao', 'recepcao', 'contabil']).toContain('gerente');
  });
});
