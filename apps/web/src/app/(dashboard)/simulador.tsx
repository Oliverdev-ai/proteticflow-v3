import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SimulationCalculationResult } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { SimulatorForm, type DraftItem } from '../../components/simulator/simulator-form';
import { ScenarioPanel } from '../../components/simulator/scenario-panel';
import { TableCompare } from '../../components/simulator/table-compare';
import { SimulationHistory } from '../../components/simulator/simulation-history';
import { BudgetPdfPreview } from '../../components/simulator/budget-pdf-preview';

type CompareResult = {
  rows: Array<{
    serviceKey: string;
    quantity: number;
    pricesByTable: Record<number, number>;
  }>;
  totalsByTable: Record<number, number>;
};

export default function SimulatorPage() {
  const utils = trpc.useUtils();
  const [clientId, setClientId] = useState<number | null>(null);
  const [pricingTableId, setPricingTableId] = useState<number | null>(null);
  const [scenarioDiscountPercent, setScenarioDiscountPercent] = useState(0);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [tableIdsForCompare, setTableIdsForCompare] = useState<number[]>([]);
  const [selectedSimulationId, setSelectedSimulationId] = useState<number | null>(null);
  const [preview, setPreview] = useState<SimulationCalculationResult | null>(null);
  const [comparison, setComparison] = useState<CompareResult | null>(null);
  const [budgetEmail, setBudgetEmail] = useState('');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [deadlineDate, setDeadlineDate] = useState(new Date().toISOString().slice(0, 10));

  const clientsQuery = trpc.clientes.list.useQuery({ page: 1, limit: 100 });
  const tablesQuery = trpc.pricing.listTables.useQuery({ page: 1, limit: 100 });

  const selectedTableId = pricingTableId ?? tablesQuery.data?.data[0]?.id ?? null;
  const tableItemsQuery = trpc.pricing.listItems.useQuery(
    { pricingTableId: selectedTableId ?? 0, page: 1, limit: 100 },
    { enabled: Boolean(selectedTableId) },
  );

  const historyQuery = trpc.simulator.listSimulations.useQuery({
    page: 1,
    limit: 20,
    clientId: clientId ?? undefined,
  });
  const simulationQuery = trpc.simulator.getSimulation.useQuery(
    { simulationId: selectedSimulationId ?? 0 },
    { enabled: Boolean(selectedSimulationId) },
  );

  const createDraftMutation = trpc.simulator.createDraft.useMutation({
    onSuccess: async (created) => {
      setSelectedSimulationId(created.id);
      await historyQuery.refetch();
    },
  });

  const sendMutation = trpc.simulator.sendBudgetEmail.useMutation({
    onSuccess: (result) => {
      setPdfBase64(result.pdfBase64 ?? null);
    },
  });

  const approveMutation = trpc.simulator.approveAndCreateJob.useMutation({
    onSuccess: async () => {
      await historyQuery.refetch();
      if (selectedSimulationId) {
        await simulationQuery.refetch();
      }
    },
  });

  const clients = useMemo(
    () => (clientsQuery.data?.data ?? []).map((client) => ({ id: client.id, name: client.name })),
    [clientsQuery.data?.data],
  );

  const tables = useMemo(
    () => (tablesQuery.data?.data ?? []).map((table) => ({ id: table.id, name: table.name })),
    [tablesQuery.data?.data],
  );

  const tableItems = useMemo(
    () =>
      (tableItemsQuery.data?.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        priceCents: item.priceCents,
      })),
    [tableItemsQuery.data?.data],
  );
  const isBootstrapping =
    clientsQuery.isLoading || tablesQuery.isLoading || tableItemsQuery.isLoading;
  const bootstrapError = clientsQuery.error ?? tablesQuery.error ?? tableItemsQuery.error;

  async function handlePreview() {
    if (!clientId || items.length === 0) return;

    const result = await utils.simulator.previewCalculation.fetch({
      clientId,
      pricingTableId,
      scenarioDiscountPercent,
      items: items.map((item) => ({
        priceItemId: item.priceItemId,
        serviceNameSnapshot: item.serviceNameSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    });

    setPreview(result);
  }

  async function handleCompare() {
    if (!clientId || items.length === 0 || tableIdsForCompare.length < 2) return;

    const result = await utils.simulator.compareTables.fetch({
      clientId,
      tableIds: tableIdsForCompare,
      items: items.map((item) => ({
        priceItemId: item.priceItemId,
        serviceNameSnapshot: item.serviceNameSnapshot,
        quantity: item.quantity,
      })),
    });

    setComparison(result as CompareResult);
  }

  async function handleCreateDraft() {
    if (!clientId || items.length === 0) return;

    await createDraftMutation.mutateAsync({
      clientId,
      pricingTableId,
      scenarioDiscountPercent,
      items: items.map((item) => ({
        priceItemId: item.priceItemId,
        serviceNameSnapshot: item.serviceNameSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    });
  }

  async function handleSendBudgetEmail() {
    if (!selectedSimulationId || !budgetEmail) return;

    const result = await sendMutation.mutateAsync({
      simulationId: selectedSimulationId,
      email: budgetEmail,
    });

    setPdfBase64(result.pdfBase64 ?? null);
  }

  async function handleApproveAndCreateJob() {
    if (!selectedSimulationId) return;

    const deadlineIso = new Date(`${deadlineDate}T12:00:00`).toISOString();
    await approveMutation.mutateAsync({
      simulationId: selectedSimulationId,
      deadline: deadlineIso,
    });
  }

  if (isBootstrapping) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Simulador de Preços</h1>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">
          Carregando dados do simulador...
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Simulador de Preços</h1>
        <div className="rounded-2xl border border-red-800 bg-red-900/20 p-6 text-sm text-red-300">
          Falha ao carregar dados iniciais: {bootstrapError.message}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Simulador de Preços</h1>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-300">
            Cadastre ao menos um cliente para gerar simulações e PDF.
          </p>
          <Link
            to="/clientes/novo"
            className="inline-flex mt-3 px-4 py-2 rounded-lg bg-primary hover:bg-primary text-white text-sm"
          >
            Cadastrar primeiro cliente
          </Link>
        </div>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Simulador de Preços</h1>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-300">
            Nenhuma tabela de preço ativa. Crie uma tabela antes de simular.
          </p>
          <Link
            to="/precos"
            className="inline-flex mt-3 px-4 py-2 rounded-lg bg-primary hover:bg-primary text-white text-sm"
          >
            Ir para tabelas de preços
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Simulador de Preços</h1>
        <p className="text-sm text-zinc-400">
          Simule, compare tabelas, envie PDF e converta em OS.
        </p>
      </div>

      <SimulatorForm
        clients={clients}
        tables={tables}
        catalogItems={tableItems}
        clientId={clientId}
        pricingTableId={pricingTableId}
        scenarioDiscountPercent={scenarioDiscountPercent}
        items={items}
        onClientChange={setClientId}
        onTableChange={setPricingTableId}
        onScenarioChange={setScenarioDiscountPercent}
        onItemsChange={setItems}
        onCreateDraft={handleCreateDraft}
      />

      <ScenarioPanel preview={preview} onPreview={handlePreview} />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Selecionar tabelas para comparar</h2>
        <div className="flex flex-wrap gap-2">
          {tables.map((table) => {
            const checked = tableIdsForCompare.includes(table.id);
            return (
              <button
                key={table.id}
                type="button"
                onClick={() =>
                  setTableIdsForCompare((prev) =>
                    checked ? prev.filter((id) => id !== table.id) : [...prev, table.id],
                  )
                }
                className={`px-3 py-1.5 rounded-lg text-sm border ${checked ? 'bg-sky-600 border-sky-500 text-white' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
              >
                {table.name}
              </button>
            );
          })}
        </div>
      </div>

      <TableCompare tableIds={tableIdsForCompare} result={comparison} onCompare={handleCompare} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimulationHistory
          items={historyQuery.data?.data ?? []}
          selectedId={selectedSimulationId}
          onSelect={setSelectedSimulationId}
        />

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">Ações</h2>
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">
              E-mail de destino
              <input
                type="email"
                value={budgetEmail}
                onChange={(event) => setBudgetEmail(event.target.value)}
                className="input-field mt-1 w-full"
                placeholder="dentista@clinica.com"
              />
            </label>
            <button
              type="button"
              onClick={handleSendBudgetEmail}
              disabled={!selectedSimulationId || !budgetEmail}
              className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm"
            >
              Enviar PDF por email
            </button>
          </div>

          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <label className="text-sm text-zinc-300">
              Prazo da OS
              <input
                type="date"
                value={deadlineDate}
                onChange={(event) => setDeadlineDate(event.target.value)}
                className="input-field mt-1"
              />
            </label>
            <button
              type="button"
              onClick={handleApproveAndCreateJob}
              disabled={!selectedSimulationId}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm"
            >
              Aprovar e criar OS
            </button>
          </div>

          {simulationQuery.data?.convertedJobId ? (
            <p className="text-sm text-emerald-400">
              OS criada: #{simulationQuery.data.convertedJobId}
            </p>
          ) : null}
          {historyQuery.isLoading && (
            <p className="text-xs text-zinc-500">Carregando historico...</p>
          )}
          {historyQuery.error && (
            <p className="text-xs text-red-400">
              Erro ao carregar historico: {historyQuery.error.message}
            </p>
          )}
          {sendMutation.error && (
            <p className="text-xs text-red-400">
              Erro ao enviar email: {sendMutation.error.message}
            </p>
          )}
          {approveMutation.error && (
            <p className="text-xs text-red-400">
              Erro ao aprovar simulacao: {approveMutation.error.message}
            </p>
          )}
        </div>
      </div>

      <BudgetPdfPreview pdfBase64={pdfBase64} />
    </div>
  );
}
