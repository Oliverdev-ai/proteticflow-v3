import { useState } from 'react';

type TabKey = 'perfil' | 'laboratorio' | 'infra' | 'equipe' | 'planos';

export interface SettingsTabsProps {
  perfil: React.ReactNode;
  laboratorio: React.ReactNode;
  infra: React.ReactNode;
  equipe: React.ReactNode;
  planos: React.ReactNode;
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'perfil', label: 'Perfil' },
  { key: 'laboratorio', label: 'Laboratorio' },
  { key: 'infra', label: 'Infra local' },
  { key: 'equipe', label: 'Equipe' },
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
        {active === 'infra' && props.infra}
        {active === 'equipe' && props.equipe}
        {active === 'planos' && props.planos}
      </div>
    </div>
  );
}
