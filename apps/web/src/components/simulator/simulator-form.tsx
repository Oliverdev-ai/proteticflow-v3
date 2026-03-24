import { useMemo, useState } from 'react';

type ClientOption = {
  id: number;
  name: string;
};

type TableOption = {
  id: number;
  name: string;
};

type CatalogItem = {
  id: number;
  name: string;
  priceCents: number;
};

export type DraftItem = {
  priceItemId: number;
  serviceNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
};

type SimulatorFormProps = {
  clients: ClientOption[];
  tables: TableOption[];
  catalogItems: CatalogItem[];
  clientId: number | null;
  pricingTableId: number | null;
  scenarioDiscountPercent: number;
  items: DraftItem[];
  onClientChange: (value: number | null) => void;
  onTableChange: (value: number | null) => void;
  onScenarioChange: (value: number) => void;
  onItemsChange: (items: DraftItem[]) => void;
  onCreateDraft: () => void;
};

export function SimulatorForm(props: SimulatorFormProps) {
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);

  const selectedCatalog = useMemo(
    () => props.catalogItems.find((item) => item.id === selectedCatalogId) ?? null,
    [props.catalogItems, selectedCatalogId],
  );

  function addItemFromCatalog() {
    if (!selectedCatalog) return;

    const existing = props.items.find((item) => item.priceItemId === selectedCatalog.id);
    if (existing) {
      props.onItemsChange(
        props.items.map((item) => item.priceItemId === selectedCatalog.id
          ? { ...item, quantity: item.quantity + 1 }
          : item),
      );
      return;
    }

    props.onItemsChange([
      ...props.items,
      {
        priceItemId: selectedCatalog.id,
        serviceNameSnapshot: selectedCatalog.name,
        quantity: 1,
        unitPriceCents: selectedCatalog.priceCents,
      },
    ]);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-lg font-semibold text-white">Dados da simulacao</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm text-neutral-300">
          Cliente
          <select
            value={props.clientId ?? ''}
            onChange={(event) => props.onClientChange(event.target.value ? Number(event.target.value) : null)}
            className="input-field mt-1 w-full"
          >
            <option value="">Selecione</option>
            {props.clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Tabela de preco
          <select
            value={props.pricingTableId ?? ''}
            onChange={(event) => props.onTableChange(event.target.value ? Number(event.target.value) : null)}
            className="input-field mt-1 w-full"
          >
            <option value="">Padrao do cliente</option>
            {props.tables.map((table) => (
              <option key={table.id} value={table.id}>{table.name}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Desconto de cenario (%)
          <input
            type="number"
            min={0}
            max={100}
            value={props.scenarioDiscountPercent}
            onChange={(event) => props.onScenarioChange(Number(event.target.value) || 0)}
            className="input-field mt-1 w-full"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="text-sm text-neutral-300">
          Servico
          <select
            value={selectedCatalogId ?? ''}
            onChange={(event) => setSelectedCatalogId(event.target.value ? Number(event.target.value) : null)}
            className="input-field mt-1 w-full"
          >
            <option value="">Selecione um servico</option>
            {props.catalogItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name} - R$ {(item.priceCents / 100).toFixed(2)}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={addItemFromCatalog}
          className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm"
        >
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {props.items.map((item) => (
          <div key={item.priceItemId} className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-700 p-3">
            <p className="text-sm text-neutral-200 flex-1">{item.serviceNameSnapshot}</p>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(event) => {
                const quantity = Math.max(1, Number(event.target.value) || 1);
                props.onItemsChange(
                  props.items.map((row) => row.priceItemId === item.priceItemId ? { ...row, quantity } : row),
                );
              }}
              className="input-field w-20"
            />
            <p className="text-sm text-neutral-400">R$ {(item.unitPriceCents / 100).toFixed(2)}</p>
            <button
              type="button"
              onClick={() => props.onItemsChange(props.items.filter((row) => row.priceItemId !== item.priceItemId))}
              className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            >
              Remover
            </button>
          </div>
        ))}
        {props.items.length === 0 ? <p className="text-sm text-neutral-500">Nenhum servico adicionado.</p> : null}
      </div>

      <button
        type="button"
        onClick={props.onCreateDraft}
        className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm"
      >
        Salvar simulacao
      </button>
    </div>
  );
}
