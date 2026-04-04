import { BrainCircuit, TrendingUp, AlertCircle } from 'lucide-react';

type Props = {
  title: string;
  prediction: string;
  confidence: number;
  type: 'positive' | 'warning' | 'info';
};

export function PredictionCard({ title, prediction, confidence, type }: Props) {
  const iconColor = {
    positive: 'text-emerald-500',
    warning: 'text-amber-500',
    info: 'text-sky-500',
  }[type];

  const Icon = {
    positive: TrendingUp,
    warning: AlertCircle,
    info: BrainCircuit,
  }[type];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur transition-all hover:bg-zinc-900 shadow-sm hover:shadow-violet-500/10 hover:border-violet-500/30">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-violet-500/10 blur-2xl" />
      <div className="flex items-start justify-between">
        <div className="space-y-3 relative z-10 w-full">
          <div className="flex items-center gap-2">
            <Icon size={18} className={iconColor} />
            <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
          </div>
          <p className="text-base text-zinc-100 pr-4">{prediction}</p>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs font-semibold tracking-wider text-violet-400 bg-violet-500/10 px-2 py-1 rounded-md uppercase">
              IA Preditiva
            </span>
            <span className="text-xs text-zinc-500">Confiança {confidence}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
