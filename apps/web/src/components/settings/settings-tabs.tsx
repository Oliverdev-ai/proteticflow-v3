import { useState, type ReactNode } from 'react';

type TabKey = 'perfil' | 'laboratorio' | 'funcionarios' | 'autorizacoes' | 'planos' | 'notificacoes';

export interface SettingsTabsProps {
  perfil: ReactNode;
  laboratorio: ReactNode;
  funcionarios: ReactNode;
  autorizacoes: ReactNode;
  planos: ReactNode;
  notificacoes?: ReactNode;
}

const BASE_TABS: Array<{ key: Exclude<TabKey, 'notificacoes'>; label: string }> = [
  { key: 'perfil', label: 'Perfil' },
  { key: 'laboratorio', label: 'Laboratorio' },
  { key: 'funcionarios', label: 'Funcionarios' },
  { key: 'autorizacoes', label: 'Autorizacoes' },
  { key: 'planos', label: 'Planos' },
];

export function SettingsTabs(props: SettingsTabsProps) {
  const [active, setActive] = useState<TabKey>('perfil');
  const tabs = props.notificacoes
    ? [...BASE_TABS, { key: 'notificacoes' as const, label: 'Notificacoes' }]
    : BASE_TABS;

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
        {active === 'notificacoes' && props.notificacoes}
      </div>
    </div>
  );
}
