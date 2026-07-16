import { describe, expect, it } from 'vitest';
import { canAccessModule, canUseAdminProcedure } from './roles';

describe('roles permissions helpers', () => {
  it('resolves module access from ROLE_PERMISSIONS including wildcard and submodules', () => {
    expect(canAccessModule('superadmin', 'financial')).toBe(true);
    expect(canAccessModule('gerente', 'financial')).toBe(true);
    expect(canAccessModule('contabil', 'financial')).toBe(true);
    expect(canAccessModule('producao', 'financial')).toBe(false);
    expect(canAccessModule('recepcao', 'financial')).toBe(false);
    expect(canAccessModule('producao', 'inventory')).toBe(true);
    expect(canAccessModule('recepcao', 'jobs')).toBe(true);
  });

  it('mirrors adminProcedure roles for UI gates', () => {
    expect(canUseAdminProcedure('superadmin')).toBe(true);
    expect(canUseAdminProcedure('gerente')).toBe(true);
    expect(canUseAdminProcedure('contabil')).toBe(false);
    expect(canUseAdminProcedure('producao')).toBe(false);
    expect(canUseAdminProcedure('recepcao')).toBe(false);
  });
});
