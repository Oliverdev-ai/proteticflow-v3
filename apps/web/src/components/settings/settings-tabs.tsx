import { useState, type ReactNode } from 'react';

type TabKey = 'perfil' | 'laboratorio' | 'funcionarios' | 'autorizacoes' | 'planos';

export interface SettingsTabsProps {
  perfil: ReactNode;
  laboratorio: ReactNode;
  funcionarios: ReactNode;
  autorizacoes: ReactNode;
  planos: ReactNode;
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'perfil', label: 'Perfil' },
  { key: 'laboratorio', label: 'Laboratorio' },
  { key: 'funcionarios', label: 'Funcionarios' },
  { key: 'autorizacoes', label: 'Autorizacoes' },
  { key: 'planos', label: 'Planos' },
];

export function SettingsTabs(props: SettingsTabsProps) {
  const [active, setActive] = useState<TabKey>('perfil');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              active === tab.key ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        {active === 'perfil' && props.perfil}
        {active === 'laboratorio' && props.laboratorio}
        {active === 'funcionarios' && props.funcionarios}
        {active === 'autorizacoes' && props.autorizacoes}
        {active === 'planos' && props.planos}
      </div>
    </div>
  );
}
