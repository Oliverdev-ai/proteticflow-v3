import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { FileBox, Plus, Printer, ScanLine } from 'lucide-react';

type PrintStatus = 'waiting' | 'sent' | 'printing' | 'completed' | 'error';
type ScannerType = 'itero' | 'medit' | '3shape' | 'carestream' | 'outro';

const STATUS_LABELS: Record<PrintStatus, string> = {
  waiting: 'Aguardando',
  sent: 'Enviado',
  printing: 'Imprimindo',
  completed: 'Concluido',
  error: 'Erro',
};

const SCANNER_LABELS: Record<ScannerType, string> = {
  itero: 'iTero',
  medit: 'Medit',
  '3shape': '3Shape',
  carestream: 'Carestream',
  outro: 'Outro',
};

function toIsoDate(dateValue: string, endOfDay = false): string | undefined {
  if (!dateValue) return undefined;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  return new Date(`${dateValue}${suffix}`).toISOString();
}

function fileNameFromKey(pathOrUrl: string | null): string {
  if (!pathOrUrl) return '-';
  const name = pathOrUrl.split('/').pop() ?? pathOrUrl;
  return decodeURIComponent(name);
}

function scannerLabel(value: string): string {
  return SCANNER_LABELS[value as ScannerType] ?? value;
}

function statusLabel(value: string): string {
  return STATUS_LABELS[value as PrintStatus] ?? value;
}

export default function ScanListPage() {
  const pageSize = 100;
  const [activeTab, setActiveTab] = useState<'all' | 'received'>('all');
  const [page, setPage] = useState(1);
  const [printStatus, setPrintStatus] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [scannerType, setScannerType] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [orphanOnly, setOrphanOnly] = useState<boolean>(false);

  const clientsQuery = trpc.clientes.list.useQuery({ page: 1, limit: 100 });

  useEffect(() => {
    setPage(1);
  }, [activeTab, printStatus, clientId, scannerType, dateFrom, dateTo, orphanOnly]);

  const query = trpc.scan.list.useQuery({
    page,
    limit: pageSize,
    printStatus: printStatus ? (printStatus as PrintStatus) : undefined,
    clientId: clientId ? Number(clientId) : undefined,
    scannerType: scannerType ? (scannerType as ScannerType) : undefined,
    dateFrom: dateFrom ? toIsoDate(dateFrom) : undefined,
    dateTo: dateTo ? toIsoDate(dateTo, true) : undefined,
    orphanOnly: activeTab === 'received' ? orphanOnly : undefined,
    hasFile: activeTab === 'received' ? true : undefined,
  });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentRows = rows;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScanLine className="text-primary" size={24} />
            Scans 3D
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Controle de arquivos STL/XML e impressão</p>
        </div>
        <Link
          to="/scans/upload"
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Novo Upload
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            activeTab === 'all'
              ? 'bg-primary text-white'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          Visao Geral
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            activeTab === 'received'
              ? 'bg-primary text-white'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700'
          }`}
        >
          Arquivos Recebidos
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          value={printStatus}
          onChange={(e) => setPrintStatus(e.target.value)}
          className="input-field"
        >
          <option value="">Todos os status</option>
          <option value="waiting">Aguardando</option>
          <option value="sent">Enviado</option>
          <option value="printing">Imprimindo</option>
          <option value="completed">Concluido</option>
          <option value="error">Erro</option>
        </select>

        {activeTab === 'received' && (
          <>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input-field"
            >
              <option value="">Todos os clientes</option>
              {clientsQuery.data?.data?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <select
              value={scannerType}
              onChange={(e) => setScannerType(e.target.value)}
              className="input-field"
            >
              <option value="">Todos os scanners</option>
              {Object.entries(SCANNER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field"
            />
          </>
        )}
      </div>

      {activeTab === 'received' && (
        <label className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={orphanOnly}
            onChange={(e) => setOrphanOnly(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
          />
          Mostrar somente scans orfaos (sem vinculo com OS)
        </label>
      )}

      {query.error && (
        <div className="mb-4 rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
          Erro ao carregar scans: {query.error.message}
        </div>
      )}
      {query.isLoading && (
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
          Carregando scans...
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {activeTab === 'all' ? (
          <table className="w-full text-sm">
            <thead className="bg-zinc-850 border-b border-zinc-800">
              <tr className="text-left text-zinc-400">
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
              {currentRows.map((row) => (
                <tr key={row.scan.id} className="border-b border-zinc-800 last:border-b-0">
                  <td className="px-4 py-3 text-zinc-300">#{row.scan.id}</td>
                  <td className="px-4 py-3 text-white">{scannerLabel(row.scan.scannerType)}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.jobCode ?? '-'}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.clientName ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs">
                      <Printer size={12} />
                      {statusLabel(row.scan.printStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(row.scan.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/scans/${row.scan.id}`} className="text-primary hover:text-primary">
                      Ver detalhe
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-850 border-b border-zinc-800">
              <tr className="text-left text-zinc-400">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Scanner</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">OS</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Orfao</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map((row) => {
                const files = [
                  row.scan.xmlUrl ? `XML: ${fileNameFromKey(row.scan.xmlUrl)}` : null,
                  row.scan.stlUpperUrl ? `STL sup: ${fileNameFromKey(row.scan.stlUpperUrl)}` : null,
                  row.scan.stlLowerUrl ? `STL inf: ${fileNameFromKey(row.scan.stlLowerUrl)}` : null,
                  row.scan.galleryImageUrl
                    ? `Galeria: ${fileNameFromKey(row.scan.galleryImageUrl)}`
                    : null,
                ].filter(Boolean) as string[];

                return (
                  <tr key={row.scan.id} className="border-b border-zinc-800 last:border-b-0">
                    <td className="px-4 py-3 text-zinc-300">
                      {new Date(row.scan.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {files.map((file) => (
                          <span
                            key={`${row.scan.id}-${file}`}
                            className="inline-flex items-center gap-1 text-xs text-zinc-300"
                          >
                            <FileBox size={12} className="text-primary" />
                            {file}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white">{scannerLabel(row.scan.scannerType)}</td>
                    <td className="px-4 py-3 text-zinc-300">{row.clientName ?? '-'}</td>
                    <td className="px-4 py-3 text-zinc-300">{row.jobCode ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs">
                        <Printer size={12} />
                        {statusLabel(row.scan.printStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.scan.jobId ? (
                        <span className="text-emerald-400 text-xs">Nao</span>
                      ) : (
                        <span className="text-amber-400 text-xs font-medium">Sim</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/scans/${row.scan.id}`}
                        className="text-primary hover:text-primary"
                      >
                        Ver detalhe
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {currentRows.length === 0 && (
          <div className="p-10 text-center text-zinc-500 text-sm">
            {activeTab === 'received'
              ? 'Nenhum arquivo recebido encontrado.'
              : 'Nenhum scan encontrado.'}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
          <span>
            {activeTab === 'received' ? 'Recebidos' : 'Scans'}: {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50"
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
