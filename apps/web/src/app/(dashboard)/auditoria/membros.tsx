import { useMemo, useState } from 'react';

type AuditMember = {
  memberId: number;
  userId: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
  blockedAt: string | null;
  blockedReason: string | null;
  blockedBy: number | null;
};

type MembersTabProps = {
  members: AuditMember[];
  isLoading: boolean;
  error: string | null;
  onBlock: (userId: number, reason: string) => Promise<void>;
  onUnblock: (userId: number) => Promise<void>;
  isMutating: boolean;
};

export function MembersTab({
  members,
  isLoading,
  error,
  onBlock,
  onUnblock,
  isMutating,
}: MembersTabProps) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedMember = useMemo(
    () => members.find((member) => member.userId === selectedUserId) ?? null,
    [members, selectedUserId],
  );

  async function handleConfirmBlock() {
    if (!selectedUserId) return;
    if (reason.trim().length < 3) return;

    setSubmitting(true);
    try {
      await onBlock(selectedUserId, reason.trim());
      setSelectedUserId(null);
      setReason('');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-zinc-400">Carregando membros...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (members.length === 0) {
    return <p className="text-sm text-zinc-400">Nenhum membro encontrado.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Acao</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.memberId} className="border-t border-zinc-800">
                <td className="px-3 py-2 text-zinc-100">{member.name}</td>
                <td className="px-3 py-2 text-zinc-300">{member.email}</td>
                <td className="px-3 py-2 text-zinc-300">{member.role}</td>
                <td className="px-3 py-2">
                  {member.blockedAt ? (
                    <span className="inline-flex items-center rounded-md bg-red-900/30 text-red-300 px-2 py-0.5 text-xs">
                      Bloqueado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-emerald-900/30 text-emerald-300 px-2 py-0.5 text-xs">
                      Ativo
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {member.blockedAt ? (
                    <button
                      type="button"
                      onClick={() => void onUnblock(member.userId)}
                      disabled={isMutating || submitting}
                      className="px-3 py-1.5 rounded-md border border-zinc-700 text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
                    >
                      Desbloquear
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(member.userId)}
                      disabled={isMutating || submitting}
                      className="px-3 py-1.5 rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      Bloquear
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedMember ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <p className="text-sm text-zinc-200">
            Bloquear <span className="font-semibold">{selectedMember.name}</span>
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Informe o motivo do bloqueio"
            className="w-full min-h-24 rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 px-3 py-2"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setSelectedUserId(null);
                setReason('');
              }}
              disabled={submitting}
              className="px-3 py-2 rounded-md border border-zinc-700 text-zinc-200 hover:border-zinc-500"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmBlock()}
              disabled={submitting || reason.trim().length < 3}
              className="px-3 py-2 rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-50"
            >
              Confirmar bloqueio
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
