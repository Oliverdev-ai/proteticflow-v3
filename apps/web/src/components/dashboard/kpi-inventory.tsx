import { Package, PackageX } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { InventoryKpis } from '@proteticflow/shared';

export function KpiInventory({ data }: { data: InventoryKpis }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiCard
        label="Itens em Estoque"
        value={String(data.totalItems)}
        icon={Package}
        sub="Materiais cadastrados"
        variant="default"
      />
      <KpiCard
        label="Abaixo do Mínimo"
        value={String(data.belowMinimum)}
        icon={PackageX}
        sub="Precisam de reposição"
        variant={data.belowMinimum > 0 ? 'warning' : 'default'}
      />
    </div>
  );
}
