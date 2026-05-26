import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBox, Plus, ScanLine } from 'lucide-react';
import { SCAN_STATUS_CHIP } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';

type PrintStatus = keyof typeof SCAN_STATUS_CHIP;
type ScannerType = 'itero' | 'medit' | '3shape' | 'carestream' | 'outro';
type TabView = 'all' | 'received';

type ScanRow = {
  id: number;
  createdAt: string;
  scannerType: ScannerType;
  jobCode: string | null;
  clientName: string | null;
  printStatus: PrintStatus;
  hasJob: boolean;
  files: string[];
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

function toPrintStatus(value: string): PrintStatus {
  if (value === 'sent' || value === 'printing' || value === 'completed' || value === 'error') {
    return value;
  }
  return 'waiting';
}

export default function ScanListPage() {
  const navigate = useNavigate();
  const pageSize = 100;
  const [activeTab, setActiveTab] = useState<TabView>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [printStatus, setPrintStatus] = useState<PrintStatus | ''>('');
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
    printStatus: printStatus || undefined,
    clientId: clientId ? Number(clientId) : undefined,
    scannerType: scannerType ? (scannerType as ScannerType) : undefined,
    dateFrom: dateFrom ? toIsoDate(dateFrom) : undefined,
    dateTo: dateTo ? toIsoDate(dateTo, true) : undefined,
    orphanOnly: activeTab === 'received' ? orphanOnly : undefined,
    hasFile: activeTab === 'received' ? true : undefined,
  });

  const rows: ScanRow[] = useMemo(
    () =>
      (query.data?.data ?? []).map((row) => {
        const files = [
          row.scan.xmlUrl ? `XML: ${fileNameFromKey(row.scan.xmlUrl)}` : null,
          row.scan.stlUpperUrl ? `STL sup: ${fileNameFromKey(row.scan.stlUpperUrl)}` : null,
          row.scan.stlLowerUrl ? `STL inf: ${fileNameFromKey(row.scan.stlLowerUrl)}` : null,
          row.scan.galleryImageUrl ? `Galeria: ${fileNameFromKey(row.scan.galleryImageUrl)}` : null,
        ].filter(Boolean) as string[];

        return {
          id: row.scan.id,
          createdAt: row.scan.createdAt.toString(),
          scannerType: row.scan.scannerType as ScannerType,
          jobCode: row.jobCode ?? null,
          clientName: row.clientName ?? null,
          printStatus: toPrintStatus(row.scan.printStatus),
          hasJob: Boolean(row.scan.jobId),
          files,
        };
      }),
    [query.data],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = normalizedSearch
    ? rows.filter((row) => {
      const files = row.files.join(' ').toLowerCase();
      return (
        row.id.toString().includes(normalizedSearch) ||
        (row.jobCode ?? '').toLowerCase().includes(normalizedSearch) ||
        (row.clientName ?? '').toLowerCase().includes(normalizedSearch) ||
        files.includes(normalizedSearch)
      );
    })
    : rows;

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const allColumns: Column<ScanRow>[] = [
    {
      id: 'id',
      header: 'ID',
      width: '90px',
      cell: (row) => <span className="t-mono">#{row.id}</span>,
    },
    {
      id: 'scanner',
      header: 'Scanner',
      width: '120px',
      cell: (row) => <span className="t-small">{SCANNER_LABELS[row.scannerType] ?? row.scannerType}</span>,
    },
    {
      id: 'job',
      header: 'OS',
      width: '140px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{row.jobCode ?? '-'}</span>,
    },
    {
      id: 'client',
      header: 'Cliente',
      width: 'flex',
      hideBelow: 'md',
      cell: (row) => <span className="truncate t-small text-[var(--fg-muted)]">{row.clientName ?? '-'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '118px',
      cell: (row) => {
        const chip = SCAN_STATUS_CHIP[row.printStatus];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
    {
      id: 'date',
      header: 'Criado em',
      width: '120px',
      align: 'right',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span>,
    },
  ];

  const receivedColumns: Column<ScanRow>[] = [
    {
      id: 'date',
      header: 'Data',
      width: '120px',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span>,
    },
    {
      id: 'files',
      header: 'Arquivos',
      width: 'flex',
      cell: (row) => (
        <div className="min-w-0">
          {row.files.length === 0 ? (
            <span className="t-small text-[var(--fg-muted)]">Sem arquivo</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {row.files.map((file) => (
                <span
                  key={`${row.id}-${file}`}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--fg-muted)]"
                >
                  <FileBox className="size-3" aria-hidden="true" />
                  {file}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'scanner',
      header: 'Scanner',
      width: '110px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small">{SCANNER_LABELS[row.scannerType] ?? row.scannerType}</span>,
    },
    {
      id: 'client',
      header: 'Cliente',
      width: '160px',
      hideBelow: 'md',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{row.clientName ?? '-'}</span>,
    },
    {
      id: 'job',
      header: 'OS',
      width: '100px',
      hideBelow: 'md',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{row.jobCode ?? '-'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '118px',
      cell: (row) => {
        const chip = SCAN_STATUS_CHIP[row.printStatus];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
    {
      id: 'orphan',
      header: 'Orfao',
      width: '80px',
      align: 'center',
      cell: (row) => (
        <StatusChip
          label={row.hasJob ? 'Nao' : 'Sim'}
          variant={row.hasJob ? 'neutral' : 'warning'}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Controle de arquivos STL/XML e status de impressao 3D."
        actions={(
          <Button type="button" onClick={() => navigate('/scans/upload')}>
            <Plus className="size-4" aria-hidden="true" />
            Novo upload
          </Button>
        )}
      >
        Scans 3D
      </PageTitle>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={cn(
            'h-9 rounded-[var(--radius-md)] border px-3 text-sm transition-colors',
            activeTab === 'all'
              ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--fg-on-primary)]'
              : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg)]',
          )}
        >
          Visao geral
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('received')}
          className={cn(
            'h-9 rounded-[var(--radius-md)] border px-3 text-sm transition-colors',
            activeTab === 'received'
              ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--fg-on-primary)]'
              : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg)]',
          )}
        >
          Arquivos recebidos
        </button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={(
          <>
            <select
              value={printStatus}
              onChange={(event) => {
                setPrintStatus(event.target.value as PrintStatus | '');
                setPage(1);
              }}
              className="h-9 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              aria-label="Filtrar por status de impressao"
            >
              <option value="">Status: Todos</option>
              <option value="waiting">Aguardando</option>
              <option value="sent">Enviado</option>
              <option value="printing">Imprimindo</option>
              <option value="completed">Concluido</option>
              <option value="error">Erro</option>
            </select>

            {activeTab === 'received' ? (
              <select
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setPage(1);
                }}
                className="h-9 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                aria-label="Filtrar por cliente"
              >
                <option value="">Cliente: Todos</option>
                {clientsQuery.data?.data?.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        )}
        actions={
          activeTab === 'received' ? (
            <button
              type="button"
              onClick={() => {
                setOrphanOnly((prev) => !prev);
                setPage(1);
              }}
              className={cn(
                'h-9 rounded-[var(--radius-md)] border px-3 text-sm transition-colors',
                orphanOnly
                  ? 'border-[var(--warning)] bg-[var(--warning)] text-white'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg)]',
              )}
            >
              Somente orfaos
            </button>
          ) : undefined
        }
      />

      {activeTab === 'received' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={scannerType}
            onChange={(event) => {
              setScannerType(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            <option value="">Scanner: Todos</option>
            {Object.entries(SCANNER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          />
        </div>
      ) : null}

      {query.error ? <p className="t-small text-[var(--destructive)]">Erro ao carregar scans: {query.error.message}</p> : null}

      <DataTable
        columns={activeTab === 'received' ? receivedColumns : allColumns}
        rows={visibleRows}
        getKey={(row) => row.id}
        onRowClick={(row) => navigate(`/scans/${row.id}`)}
        loading={query.isLoading}
        loadingRows={8}
        empty={{
          title: activeTab === 'received' ? 'Nenhum arquivo recebido encontrado' : 'Nenhum scan encontrado',
          description: 'Ajuste os filtros para continuar.',
          cta: (
            <Button type="button" size="sm" onClick={() => navigate('/scans/upload')}>
              Novo upload
            </Button>
          ),
        }}
      />

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="t-small text-[var(--fg-muted)]">
            {activeTab === 'received' ? 'Recebidos' : 'Scans'}: {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <span className="t-small rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5">
              Pagina {page} de {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Proxima
            </Button>
          </div>
        </div>
      ) : null}

      <div className="t-small flex items-center gap-2 text-[var(--fg-muted)]">
        <ScanLine className="size-4" aria-hidden="true" />
        Visualizando: {activeTab === 'received' ? 'arquivos recebidos' : 'visao geral'}
      </div>
    </div>
  );
}
