import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { ScanLine, Plus, Printer } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Aguardando',
  sent: 'Enviado',
  printing: 'Imprimindo',
  completed: 'Concluido',
  error: 'Erro',
};

export default function ScanListPage() {
  const [printStatus, setPrintStatus] = useState<string>('');
  const query = trpc.scan.list.useQuery({
    page: 1,
    limit: 100,
    printStatus: printStatus ? (printStatus as 'waiting' | 'sent' | 'printing' | 'completed' | 'error') : undefined,
  });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScanLine className="text-violet-500" size={24} />
            Scans 3D
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Controle de arquivos STL/XML e impressao</p>
        </div>
        <Link
          to="/scans/upload"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Novo Upload
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <select
          value={printStatus}
          onChange={(e) => setPrintStatus(e.target.value)}
          className="input-field max-w-xs"
        >
          <option value="">Todos os status</option>
          <option value="waiting">Aguardando</option>
          <option value="sent">Enviado</option>
          <option value="printing">Imprimindo</option>
          <option value="completed">Concluido</option>
          <option value="error">Erro</option>
        </select>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-850 border-b border-neutral-800">
            <tr className="text-left text-neutral-400">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Scanner</th>
              <th className="px-4 py-3">OS</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Criado em</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.scan.id} className="border-b border-neutral-800 last:border-b-0">
                <td className="px-4 py-3 text-neutral-300">#{row.scan.id}</td>
                <td className="px-4 py-3 text-white">{row.scan.scannerType}</td>
                <td className="px-4 py-3 text-neutral-300">{row.jobCode ?? '-'}</td>
                <td className="px-4 py-3 text-neutral-300">{row.clientName ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-neutral-800 text-neutral-300 text-xs">
                    <Printer size={12} />
                    {STATUS_LABELS[row.scan.printStatus] ?? row.scan.printStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-400">{new Date(row.scan.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/scans/${row.scan.id}`} className="text-violet-400 hover:text-violet-300">
                    Ver detalhe
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-10 text-center text-neutral-500 text-sm">Nenhum scan encontrado.</div>
        )}
      </div>
    </div>
  );
}

