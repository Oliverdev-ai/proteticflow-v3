import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../hooks/use-tenant';

export function TenantSwitcher() {
  const { current, list, switchTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!current) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white transition-colors"
      >
        <Building2 size={16} className="text-violet-400" />
        <span className="max-w-[180px] truncate font-medium">{current.name}</span>
        <ChevronDown size={14} className="text-neutral-500" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <p className="text-xs text-neutral-500 uppercase tracking-widest px-3 pt-3 pb-1">Laboratórios</p>
          {list?.map(t => (
            <button
              key={t.id}
              onClick={() => { switchTenant(t.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-neutral-700 transition-colors ${
                t.id === current.id ? 'text-violet-400' : 'text-neutral-200'
              }`}
            >
              <Building2 size={14} />
              <span className="truncate">{t.name}</span>
              {t.id === current.id && <span className="ml-auto text-xs text-violet-500">ativo</span>}
            </button>
          ))}
          <div className="border-t border-neutral-700 mt-1">
            <button
              onClick={() => { navigate('/onboarding'); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors flex items-center gap-2"
            >
              <Plus size={14} />
              Novo laboratório
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
