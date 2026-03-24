import { useMemo, useState } from 'react';
import { trpc } from '../../lib/trpc';

type PortalTokenManagerProps = {
  clientId: number;
};

export function PortalTokenManager({ clientId }: PortalTokenManagerProps) {
  const utils = trpc.useUtils();
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [email, setEmail] = useState('');
  const [latestPortalUrl, setLatestPortalUrl] = useState<string | null>(null);

  const listQuery = trpc.portal.listTokensByClient.useQuery({ clientId });

  const createMutation = trpc.portal.createToken.useMutation({
    onSuccess: async (createdToken) => {
      setLatestPortalUrl(`${window.location.origin}${createdToken.portalUrlPath}`);
      await utils.portal.listTokensByClient.invalidate({ clientId });
    },
  });

  const revokeMutation = trpc.portal.revokeToken.useMutation({
    onSuccess: async () => {
      await utils.portal.listTokensByClient.invalidate({ clientId });
    },
  });

  const sendMutation = trpc.portal.sendPortalLink.useMutation();

  const tokens = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-white font-semibold mb-3">Gerar novo token</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-neutral-300">
            Expira em (dias)
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
              className="input-field mt-1 w-32"
            />
          </label>
          <button
            type="button"
            onClick={() => createMutation.mutate({ clientId, expiresInDays })}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm"
          >
            Gerar token
          </button>
          <button
            type="button"
            disabled={!latestPortalUrl}
            onClick={() => latestPortalUrl && navigator.clipboard.writeText(latestPortalUrl)}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
          >
            Copiar ultimo link gerado
          </button>
        </div>
        {latestPortalUrl ? (
          <p className="text-xs text-neutral-300 mt-3 break-all">{latestPortalUrl}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-white font-semibold mb-3">Tokens do cliente</h2>
        <div className="space-y-3">
          {tokens.map((token) => (
            <article key={token.id} className="rounded-xl border border-neutral-700 p-4">
              <p className="text-sm text-neutral-200">Token #{token.id}</p>
              <p className="text-xs text-neutral-400 mt-1">Expira em: {new Date(token.expiresAt).toLocaleString('pt-BR')}</p>
              <p className="text-xs text-neutral-400">Status: {token.isActive ? 'Ativo' : 'Inativo'}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded bg-neutral-800 text-neutral-200 opacity-60 cursor-not-allowed"
                  disabled
                >
                  Link visivel apenas na geracao
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded bg-amber-700 text-amber-100 hover:bg-amber-600"
                  onClick={() => revokeMutation.mutate({ tokenId: token.id })}
                >
                  Revogar
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded bg-blue-700 text-blue-100 hover:bg-blue-600"
                  onClick={() => email && sendMutation.mutate({ tokenId: token.id, email })}
                >
                  Reenviar link
                </button>
              </div>
            </article>
          ))}
          {tokens.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum token gerado para este cliente.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-white font-semibold mb-3">Destino de email</h2>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="destinatario@exemplo.com"
          className="input-field w-full md:w-80"
        />
        <p className="text-xs text-neutral-500 mt-2">Usado na acao de reenviar link.</p>
      </section>
    </div>
  );
}
