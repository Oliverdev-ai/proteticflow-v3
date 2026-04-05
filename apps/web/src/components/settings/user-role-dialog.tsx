import { useState } from 'react';
import type { SettingsUserItem } from '@proteticflow/shared';
import { useSettings } from '../../hooks/use-settings';

export function UserRoleDialog({ user }: { user: SettingsUserItem }) {
  const { updateRole } = useSettings();
  const [role, setRole] = useState(user.role);

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as SettingsUserItem['role'])}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
      >
        <option value="superadmin">superadmin</option>
        <option value="gerente">gerente</option>
        <option value="producao">producao</option>
        <option value="recepcao">recepcao</option>
        <option value="contabil">contabil</option>
      </select>
      <button
        onClick={() => updateRole.mutate({ memberId: user.id, role })}
        className="bg-primary hover:bg-primary text-white text-xs px-2 py-1 rounded"
      >
        Salvar role
      </button>
    </div>
  );
}
