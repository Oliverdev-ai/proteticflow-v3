import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Printer, Send, Download } from 'lucide-react';
import { StlViewer } from '../../../components/scans/stl-viewer';

const NEXT_STATUS: Record<string, Array<'sent' | 'printing' | 'completed' | 'error'>> = {
  waiting: ['sent'],
  sent: ['printing', 'error'],
  printing: ['completed', 'error'],
  completed: [],
  error: [],
};

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scanId = Number(id);

  const query = trpc.scan.get.useQuery({ id: scanId }, { enabled: Number.isFinite(scanId) });
  const changeStatus = trpc.scan.changePrintStatus.useMutation({
    onSuccess: () => query.refetch(),
  });
  const sendToPrinter = trpc.scan.sendToPrinter.useMutation({
    onSuccess: () => query.refetch(),
  });

  const row = query.data;
  const scan = row?.scan;

  if (query.isLoading) return <div className="p-6 text-neutral-400">Carregando...</div>;
  if (!row || !scan) return <div className="p-6 text-red-400">Scan nao encontrado.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate('/scans')} className="flex items-center gap-2 text-neutral-400 hover:text-white text-sm">
        <ArrowLeft size={14} />
        Voltar
      </button>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <h1 className="text-xl font-bold text-white mb-1">Scan #{scan.id}</h1>
        <p className="text-sm text-neutral-400">Scanner: {scan.scannerType} | Status: {scan.printStatus}</p>
        <p className="text-sm text-neutral-500 mt-1">OS: {row.jobCode ?? '-'} | Cliente: {row.clientName ?? '-'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-white font-semibold">Arquivos</h2>
          {row.downloadUrls.stlUpper && (
            <div className="mb-4">
              <StlViewer url={row.downloadUrls.stlUpper} />
              <a className="text-violet-400 hover:text-violet-300 flex items-center gap-2 mt-2" href={row.downloadUrls.stlUpper} target="_blank" rel="noreferrer"><Download size={14} />Download STL Superior</a>
            </div>
          )}
          {row.downloadUrls.stlLower && <a className="text-violet-400 hover:text-violet-300 flex items-center gap-2" href={row.downloadUrls.stlLower} target="_blank" rel="noreferrer"><Download size={14} />Download STL Inferior</a>}
          {row.downloadUrls.xml && <a className="text-violet-400 hover:text-violet-300 flex items-center gap-2" href={row.downloadUrls.xml} target="_blank" rel="noreferrer"><Download size={14} />Download XML</a>}
          {row.downloadUrls.gallery && <a className="text-violet-400 hover:text-violet-300 flex items-center gap-2" href={row.downloadUrls.gallery} target="_blank" rel="noreferrer"><Download size={14} />Abrir Imagem</a>}
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-white font-semibold">Acoes de Impressao</h2>
          <div className="flex flex-wrap gap-2">
            {(NEXT_STATUS[scan.printStatus] ?? []).map((status) => (
              <button
                key={status}
                onClick={() => changeStatus.mutate({ scanId: scan.id, status, printError: status === 'error' ? 'Erro manual' : undefined })}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm"
              >
                <Printer size={14} className="inline mr-1" />
                {status}
              </button>
            ))}
          </div>
          <button
            onClick={() => sendToPrinter.mutate({ scanId: scan.id, printerIp: '127.0.0.1' })}
            className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm"
          >
            <Send size={14} className="inline mr-1" />
            Enviar para Impressora (stub)
          </button>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-3">Dados Parseados do XML</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <p className="text-neutral-300">Order ID: <span className="text-white">{scan.parsedOrderId ?? '-'}</span></p>
          <p className="text-neutral-300">Dentista: <span className="text-white">{scan.parsedDentist ?? '-'}</span></p>
          <p className="text-neutral-300">CRO: <span className="text-white">{scan.parsedCro ?? '-'}</span></p>
          <p className="text-neutral-300">Paciente: <span className="text-white">{scan.parsedPatient ?? '-'}</span></p>
          <p className="text-neutral-300">Procedimento: <span className="text-white">{scan.parsedProcedure ?? '-'}</span></p>
          <p className="text-neutral-300">Prazo: <span className="text-white">{scan.parsedDeadline ? new Date(scan.parsedDeadline).toLocaleString('pt-BR') : '-'}</span></p>
        </div>
      </div>

      <div className="text-xs text-neutral-500">
        {changeStatus.error?.message || sendToPrinter.error?.message}
      </div>
    </div>
  );
}

