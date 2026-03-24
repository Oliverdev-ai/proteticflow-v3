import { useSettings } from '../../hooks/use-settings';
import { UserRoleDialog } from './user-role-dialog';

export function TeamUsersTable() {
  const { overview } = useSettings();

  const users = overview.data?.users ?? [];

  if (users.length === 0) {
    return <p className="text-sm text-neutral-400">Nenhum usuario no tenant.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-neutral-400">
            <th className="text-left py-2">Nome</th>
            <th className="text-left py-2">Email</th>
            <th className="text-left py-2">Role</th>
            <th className="text-left py-2">Acoes</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-neutral-800">
              <td className="py-2 text-white">{user.name}</td>
              <td className="py-2 text-neutral-300">{user.email}</td>
              <td className="py-2 text-neutral-300">{user.role}</td>
              <td className="py-2"><UserRoleDialog user={user} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
