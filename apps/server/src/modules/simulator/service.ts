export type SimulationEngineLineInput = {
  priceItemId: number | null;
  serviceNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  estimatedUnitCostCents: number;
};

export type SimulationEngineInput = {
  lines: SimulationEngineLineInput[];
  clientAdjustmentPercent: number;
  scenarioDiscountPercent: number;
};

export type SimulationEngineResult = {
  subtotalCents: number;
  adjustedSubtotalCents: number;
  totalCents: number;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  estimatedMarginPercent: number;
  lines: Array<{
    priceItemId: number | null;
    serviceNameSnapshot: string;
    quantity: number;
    unitPriceCentsSnapshot: number;
    estimatedUnitCostCentsSnapshot: number;
    lineSubtotalCents: number;
    lineTotalCents: number;
  }>;
};

type CompareTableInput = {
  tableId: number;
  pricesByServiceKey: Record<string, number>;
};

type CompareServiceInput = {
  serviceKey: string;
  quantity: number;
};

export type CompareTablesResult = {
  rows: Array<{
    serviceKey: string;
    quantity: number;
    pricesByTable: Record<number, number>;
  }>;
  totalsByTable: Record<number, number>;
};

function roundMoney(value: number) {
  return Math.round(value);
}

export function calculateSimulation(input: SimulationEngineInput): SimulationEngineResult {
  const lines = input.lines.map((line) => {
    const lineSubtotalCents = roundMoney(line.quantity * line.unitPriceCents);
    const adjusted = roundMoney(lineSubtotalCents * (1 + input.clientAdjustmentPercent / 100));
    const lineTotalCents = roundMoney(adjusted * (1 - input.scenarioDiscountPercent / 100));

    return {
      priceItemId: line.priceItemId,
      serviceNameSnapshot: line.serviceNameSnapshot,
      quantity: line.quantity,
      unitPriceCentsSnapshot: line.unitPriceCents,
      estimatedUnitCostCentsSnapshot: line.estimatedUnitCostCents,
      lineSubtotalCents,
      lineTotalCents,
      adjustedLineCents: adjusted,
      lineEstimatedCostCents: line.quantity * line.estimatedUnitCostCents,
    };
  });

  const subtotalCents = lines.reduce((acc, line) => acc + line.lineSubtotalCents, 0);
  const adjustedSubtotalCents = lines.reduce((acc, line) => acc + line.adjustedLineCents, 0);
  const totalCents = lines.reduce((acc, line) => acc + line.lineTotalCents, 0);
  const estimatedCostCents = lines.reduce((acc, line) => acc + line.lineEstimatedCostCents, 0);
  const estimatedMarginCents = totalCents - estimatedCostCents;
  const estimatedMarginPercent = totalCents === 0 ? 0 : Number(((estimatedMarginCents / totalCents) * 100).toFixed(2));

  return {
    subtotalCents,
    adjustedSubtotalCents,
    totalCents,
    estimatedCostCents,
    estimatedMarginCents,
    estimatedMarginPercent,
    lines: lines.map((line) => ({
      priceItemId: line.priceItemId,
      serviceNameSnapshot: line.serviceNameSnapshot,
      quantity: line.quantity,
      unitPriceCentsSnapshot: line.unitPriceCentsSnapshot,
      estimatedUnitCostCentsSnapshot: line.estimatedUnitCostCentsSnapshot,
      lineSubtotalCents: line.lineSubtotalCents,
      lineTotalCents: line.lineTotalCents,
    })),
  };
}

export function compareTables(
  services: CompareServiceInput[],
  tables: CompareTableInput[],
): CompareTablesResult {
  const rows = services.map((service) => {
    const pricesByTable: Record<number, number> = {};

    for (const table of tables) {
      const unitPrice = table.pricesByServiceKey[service.serviceKey] ?? 0;
      pricesByTable[table.tableId] = roundMoney(service.quantity * unitPrice);
    }

    return {
      serviceKey: service.serviceKey,
      quantity: service.quantity,
      pricesByTable,
    };
  });

  const totalsByTable: Record<number, number> = {};
  for (const table of tables) {
    totalsByTable[table.tableId] = rows.reduce((acc, row) => acc + (row.pricesByTable[table.tableId] ?? 0), 0);
  }

  return { rows, totalsByTable };
}
