import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { Role } from '@proteticflow/shared';

const permissionState = vi.hoisted(() => ({ role: 'gerente' as Role }));

vi.mock('../../hooks/use-permissions', () => ({
  usePermissions: () => ({
    role: permissionState.role,
    modules: [],
    hasAccess: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('./profile-form', () => ({ ProfileForm: () => <div>Perfil</div> }));
vi.mock('./lab-tab', () => ({ LabTab: () => <div>Laboratorio</div> }));
vi.mock('./employees-tab', () => ({ EmployeesTab: () => <div>Equipe</div> }));
vi.mock('./authorizations-tab', () => ({ AuthorizationsTab: () => <div>Autorizacoes</div> }));
vi.mock('./plans-tab', () => ({ PlansTab: () => <div>Plano</div> }));
vi.mock('./notifications-tab', () => ({ NotificationsTab: () => <div>Notificacoes</div> }));
vi.mock('./flow-ai-tab', () => ({ FlowAiTab: () => <div>Flow IA</div> }));
vi.mock('./flow-ai-memory-tab', () => ({ FlowAiMemoryTab: () => <div>Memoria IA Content</div> }));
vi.mock('./proactive-preferences-tab', () => ({
  ProactivePreferencesTab: () => <div>Preferencias</div>,
}));
vi.mock('../fiscal/fiscal-settings-form', () => ({
  FiscalSettingsForm: () => <div>Fiscal</div>,
}));

import { SettingsTabs } from './settings-tabs';

function renderForRole(role: Role): string {
  permissionState.role = role;
  return renderToString(<SettingsTabs />);
}

describe('SettingsTabs role guards', () => {
  it('renders Memória IA for admin roles only', () => {
    expect(renderForRole('gerente')).toContain('Memória IA');
    expect(renderForRole('superadmin')).toContain('Memória IA');
    expect(renderForRole('contabil')).not.toContain('Memória IA');
    expect(renderForRole('producao')).not.toContain('Memória IA');
    expect(renderForRole('recepcao')).not.toContain('Memória IA');
  });
});
