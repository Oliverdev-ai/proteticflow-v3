import { ShieldAlert } from 'lucide-react';
import { usePermissions } from '../../../hooks/use-permissions';
import { useSettings } from '../../../hooks/use-settings';
import { SettingsTabs } from '../../../components/settings/settings-tabs';
import { ProfileTab } from '../../../components/settings/profile-tab';
import { LabTab } from '../../../components/settings/lab-tab';
import { EmployeesTab } from '../../../components/settings/employees-tab';
import { AuthorizationsTab } from '../../../components/settings/authorizations-tab';
import { PlansTab } from '../../../components/settings/plans-tab';
import { NotificationsTab } from '../../../components/settings/notifications-tab';
import { FiscalSettingsForm } from '../../../components/fiscal/fiscal-settings-form';

export default function SettingsPage() {
  const { hasAccess } = usePermissions();
  const { overview } = useSettings();

  if (!hasAccess('settings')) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <ShieldAlert className="text-red-400" />
        <p className="text-red-300 text-sm">Voce nao possui permissao para acessar Configuracoes.</p>
      </div>
    );
  }

  if (overview.isLoading) {
    return <p className="text-sm text-neutral-400">Carregando configuracoes...</p>;
  }

  if (overview.error) {
    return <p className="text-sm text-red-400">Erro ao carregar configuracoes: {overview.error.message}</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Configuracoes</h1>
      <SettingsTabs
        perfil={<ProfileTab />}
        laboratorio={<LabTab />}
        funcionarios={<EmployeesTab />}
        autorizacoes={<AuthorizationsTab />}
        planos={<PlansTab />}
        notificacoes={<NotificationsTab />}
        fiscal={<FiscalSettingsForm />}
      />
    </div>
  );
}
