export type SimulationStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface SimulationItemDto {
  id: number;
  priceItemId: number | null;
  serviceNameSnapshot: string;
  categorySnapshot: string | null;
  unitPriceCentsSnapshot: number;
  estimatedUnitCostCentsSnapshot: number;
  quantity: number;
  lineSubtotalCents: number;
  lineTotalCents: number;
}

export interface SimulationDto {
  id: number;
  tenantId: number;
  clientId: number;
  pricingTableId: number | null;
  status: SimulationStatus;
  title: string | null;
  notes: string | null;
  clientAdjustmentPercent: string;
  scenarioDiscountPercent: string;
  subtotalCents: number;
  adjustedSubtotalCents: number;
  totalCents: number;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  convertedJobId: number | null;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: SimulationItemDto[];
}

export interface SimulationCalculationResult {
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
}

export interface TableComparisonRow {
  serviceKey: string;
  quantity: number;
  pricesByTable: Record<number, number>;
}
