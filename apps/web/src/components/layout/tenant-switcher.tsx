import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../hooks/use-tenant';

export function TenantSwitcher() {
  const { current, list, switchTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!current) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 rounded-lg border border-border bg-secondary text-sm text-foreground hover:bg-[rgb(var(--secondary))] flex items-center gap-2 transition-colors"
      >
        <Building2 size={15} className="text-primary" />
        <span className="max-w-[180px] truncate font-medium">{current.name}</span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-3 pt-3 pb-1">Laboratorios</p>
          {list?.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => {
                switchTenant(tenant.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary transition-colors ${
                tenant.id === current.id ? 'text-primary' : 'text-foreground'
              }`}
            >
              <Building2 size={14} />
              <span className="truncate">{tenant.name}</span>
              {tenant.id === current.id && <span className="ml-auto text-xs text-primary">ativo</span>}
            </button>
          ))}
          <div className="border-t border-border mt-1">
            <button
              onClick={() => {
                navigate('/onboarding');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
            >
              <Plus size={14} />
              Novo laboratorio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

