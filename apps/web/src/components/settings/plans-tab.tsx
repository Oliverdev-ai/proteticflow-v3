import { PlanSummary } from './plan-summary';

export function PlansTab() {
  return (
    <div className="space-y-4">
      <h4 className="text-white font-medium">Plano (somente leitura nesta fase)</h4>
      <PlanSummary />
    </div>
  );
}
