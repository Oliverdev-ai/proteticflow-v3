import { ROLE_PERMISSIONS, ROLE_LABELS, type Role } from '@proteticflow/shared';

export function RolesMatrix() {
  const roles = Object.keys(ROLE_PERMISSIONS) as Role[];

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-neutral-400">
            <th className="text-left py-2">Role</th>
            <th className="text-left py-2">Modulos</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role} className="border-t border-neutral-800">
              <td className="py-2 text-white">{ROLE_LABELS[role]}</td>
              <td className="py-2 text-neutral-300">{ROLE_PERMISSIONS[role].modules.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
