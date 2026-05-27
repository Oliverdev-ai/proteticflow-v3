import { Truck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { TodayDeliveries } from '@proteticflow/shared';

type Row = { label: string; count: number; icon: React.ElementType; color: string };

export function TodayDeliveriesCard({ data }: { data: TodayDeliveries }) {
  const rows: Row[] = [
    { label: 'Agendadas', count: data.scheduled, icon: Clock, color: 'text-muted-foreground' },
    { label: 'Em trânsito', count: data.inTransit, icon: Truck, color: 'text-primary' },
    { label: 'Entregues', count: data.delivered, icon: CheckCircle2, color: 'text-[var(--success)]' },
    { label: 'Falhas', count: data.failed, icon: XCircle, color: 'text-[var(--destructive)]' },
  ];

  return (
    <div className="bg-muted border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Entregas de Hoje</h3>
        <span className="text-xs text-muted-foreground">{data.total} total</span>
      </div>
      {data.total === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma entrega agendada hoje</p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ label, count, icon: Icon, color }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={14} className={color} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <span className={`text-sm font-semibold ${color}`}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
