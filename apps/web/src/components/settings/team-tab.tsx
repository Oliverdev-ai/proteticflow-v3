import { TeamUsersTable } from './team-users-table';
import { RolesMatrix } from './roles-matrix';

export function TeamTab() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-white font-medium">Equipe</h4>
        <p className="text-sm text-zinc-400">Gestao de roles e visualizacao de permissoes.</p>
      </div>
      <TeamUsersTable />
      <RolesMatrix />
    </div>
  );
}
