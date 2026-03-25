import { TeamUsersTable } from './team-users-table';
import { RolesMatrix } from './roles-matrix';

export function AuthorizationsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-white font-medium">Autorizacoes</h4>
        <p className="text-sm text-neutral-400">Edicao de role (gerente/superadmin) e matriz de permissoes.</p>
      </div>
      <TeamUsersTable showRoleActions={true} />
      <RolesMatrix />
    </div>
  );
}
