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
    return <p className="text-sm text-muted-foreground">Carregando membros...</p>;
  }

  if (error) {
    return <p className="text-sm text-[var(--destructive)]">{error}</p>;
  }

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.memberId} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">{member.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{member.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{member.role}</td>
                <td className="px-3 py-2">
                  {member.blockedAt ? (
                    <span className="inline-flex items-center rounded-md bg-[var(--destructive-soft)] text-[var(--destructive)] px-2 py-0.5 text-xs">
                      Bloqueado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-[var(--success-soft)] text-[var(--success)] px-2 py-0.5 text-xs">
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
                      className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:border-border disabled:opacity-50"
                    >
                      Desbloquear
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(member.userId)}
                      disabled={isMutating || submitting}
                      className="px-3 py-1.5 rounded-md bg-[var(--destructive-soft)] text-white hover:bg-[var(--destructive-soft)] disabled:opacity-50"
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
        <div className="rounded-xl border border-border bg-muted p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Bloquear <span className="font-semibold">{selectedMember.name}</span>
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Informe o motivo do bloqueio"
            className="w-full min-h-24 rounded-lg border border-border bg-muted text-muted-foreground px-3 py-2"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setSelectedUserId(null);
                setReason('');
              }}
              disabled={submitting}
              className="px-3 py-2 rounded-md border border-border text-muted-foreground hover:border-border"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmBlock()}
              disabled={submitting || reason.trim().length < 3}
              className="px-3 py-2 rounded-md bg-[var(--destructive-soft)] text-white hover:bg-[var(--destructive-soft)] disabled:opacity-50"
            >
              Confirmar bloqueio
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
