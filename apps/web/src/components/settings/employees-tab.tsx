import { TeamUsersTable } from './team-users-table';

export function EmployeesTab() {
  return (
    <div className="space-y-4">
      <h4 className="text-white font-medium">Funcionarios</h4>
      <p className="text-sm text-neutral-400">Lista de membros do tenant.</p>
      <TeamUsersTable showRoleActions={false} />
    </div>
  );
}
