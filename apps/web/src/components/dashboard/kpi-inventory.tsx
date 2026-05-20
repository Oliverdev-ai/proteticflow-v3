import { Package, PackageX } from 'lucide-react';
import { KpiCard } from '../shared/kpi-card';
import type { InventoryKpis } from '@proteticflow/shared';

export function KpiInventory({ data }: { data: InventoryKpis }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiCard
        label="Itens em Estoque"
        value={data.totalItems}
        icon={Package}
      />
      <KpiCard
        label="Abaixo do Mínimo"
        value={data.belowMinimum}
        icon={PackageX}
        trend={data.belowMinimum > 0 ? { direction: 'down' } : undefined}
      />
    </div>
  );
}
