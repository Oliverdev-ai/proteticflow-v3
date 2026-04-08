type AbcClassification = 'A' | 'B' | 'C';

export type AbcTableItem = {
  label: string;
  value: number;
  percentage: number;
  accumulatedPercentage: number;
  classification: AbcClassification;
};

type AbcTableMode = 'currency' | 'count';

type AbcTableProps = {
  items: AbcTableItem[];
  mode: AbcTableMode;
};

function formatValue(value: number, mode: AbcTableMode): string {
  if (mode === 'currency') {
    return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return value.toLocaleString('pt-BR');
}

function badgeClass(classification: AbcClassification): string {
  if (classification === 'A') return 'bg-primary/10 text-primary border-primary/20';
  if (classification === 'B') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

export function AbcTable({ items, mode }: AbcTableProps) {
  if (items.length === 0) {
    return (
      <div className="premium-card rounded-2xl border-dashed p-10 text-center text-sm text-muted-foreground">
        Nenhum dado encontrado para o periodo selecionado.
      </div>
    );
  }

  return (
    <div className="premium-card overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-bold">#</th>
            <th className="px-4 py-3 text-left font-bold">Nome</th>
            <th className="px-4 py-3 text-right font-bold">Valor</th>
            <th className="px-4 py-3 text-right font-bold">%</th>
            <th className="px-4 py-3 text-right font-bold">% Acumulado</th>
            <th className="px-4 py-3 text-center font-bold">Classe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {items.map((item, index) => {
            const previous = index > 0 ? items[index - 1] : null;
            const classificationChanged = previous && previous.classification !== item.classification;

            return (
              <tr
                key={`${item.label}-${index}`}
                className={`hover:bg-muted/10 ${classificationChanged ? 'border-t-2 border-border' : ''}`}
              >
                <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                <td className="px-4 py-3 font-semibold text-foreground">{item.label}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatValue(item.value, mode)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {item.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {item.accumulatedPercentage.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  %
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${badgeClass(item.classification)}`}
                  >
                    {item.classification}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

