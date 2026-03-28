type CompareResult = {
  rows: Array<{
    serviceKey: string;
    quantity: number;
    pricesByTable: Record<number, number>;
  }>;
  totalsByTable: Record<number, number>;
};

type TableCompareProps = {
  tableIds: number[];
  result: CompareResult | null;
  onCompare: () => void;
};

export function TableCompare({ tableIds, result, onCompare }: TableCompareProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Comparativo entre tabelas</h2>
        <button
          type="button"
          onClick={onCompare}
          className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm"
        >
          Comparar
        </button>
      </div>

      {!result ? (
        <p className="text-sm text-neutral-500">Selecione duas ou mais tabelas e execute a comparacao.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-800">
                <th className="py-2">Servico</th>
                <th className="py-2">Qtd</th>
                {tableIds.map((tableId) => (
                  <th key={tableId} className="py-2">Tabela {tableId}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.serviceKey} className="border-b border-neutral-800/60">
                  <td className="py-2 text-neutral-200">{row.serviceKey}</td>
                  <td className="py-2 text-neutral-300">{row.quantity}</td>
                  {tableIds.map((tableId) => (
                    <td key={tableId} className="py-2 text-neutral-300">R$ {((row.pricesByTable[tableId] ?? 0) / 100).toFixed(2)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="pt-3 text-neutral-400 font-semibold">Total</td>
                <td className="pt-3" />
                {tableIds.map((tableId) => (
                  <td key={tableId} className="pt-3 text-emerald-400 font-semibold">R$ {((result.totalsByTable[tableId] ?? 0) / 100).toFixed(2)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
