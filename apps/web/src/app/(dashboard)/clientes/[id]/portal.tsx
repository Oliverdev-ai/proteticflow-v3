import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PortalTokenManager } from '../../../../components/clients/portal-token-manager';

export default function ClientPortalManagementPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id ?? 0);

  if (!clientId) {
    return <div className="text-sm text-red-400">Cliente invalido.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/clientes/${clientId}`)}
          className="text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Portal do cliente</h1>
          <p className="text-sm text-zinc-400">Gestao de token de acesso publico por cliente.</p>
        </div>
      </div>

      <PortalTokenManager clientId={clientId} />
    </div>
  );
}
