import { describe, expect, it } from 'vitest';
import { calculateSimulation, compareTables } from './service.js';

describe('Simulator Engine', () => {
  it('calcula subtotal + ajuste de cliente + desconto de cenario', () => {
    const result = calculateSimulation({
      clientAdjustmentPercent: 10,
      scenarioDiscountPercent: 5,
      lines: [
        {
          priceItemId: 1,
          serviceNameSnapshot: 'Coroa',
          quantity: 2,
          unitPriceCents: 10000,
          estimatedUnitCostCents: 4500,
        },
      ],
    });

    expect(result.subtotalCents).toBe(20000);
    expect(result.adjustedSubtotalCents).toBe(22000);
    expect(result.totalCents).toBe(20900);
  });

  it('retorna margem estimada', () => {
    const result = calculateSimulation({
      clientAdjustmentPercent: 0,
      scenarioDiscountPercent: 0,
      lines: [
        {
          priceItemId: null,
          serviceNameSnapshot: 'Ponte',
          quantity: 1,
          unitPriceCents: 30000,
          estimatedUnitCostCents: 18000,
        },
      ],
    });

    expect(result.estimatedCostCents).toBe(18000);
    expect(result.estimatedMarginCents).toBe(12000);
    expect(result.estimatedMarginPercent).toBe(40);
  });

  it('compara mesma lista de servicos em tabelas diferentes', () => {
    const comparison = compareTables(
      [
        { serviceKey: 'coroa', quantity: 1 },
        { serviceKey: 'ponte', quantity: 2 },
      ],
      [
        { tableId: 10, pricesByServiceKey: { coroa: 10000, ponte: 20000 } },
        { tableId: 11, pricesByServiceKey: { coroa: 12000, ponte: 18000 } },
      ],
    );

    expect(comparison.rows).toHaveLength(2);
    expect(comparison.totalsByTable[10]).toBe(50000);
    expect(comparison.totalsByTable[11]).toBe(48000);
  });
});
