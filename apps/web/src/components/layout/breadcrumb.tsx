import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NAV_ALL_ITEMS } from './navigation';

/* Mapa path → label legível */
const LABEL_MAP: Record<string, string> = Object.fromEntries(
  NAV_ALL_ITEMS.map((item) => [item.href, item.label]),
);

/* Labels extras para segmentos dinâmicos */
const SEGMENT_LABELS: Record<string, string> = {
  trabalhos: 'Trabalhos',
  clientes: 'Clientes',
  financeiro: 'Financeiro',
  relatorios: 'Relatórios',
  fiscal: 'Fiscal',
  suporte: 'Suporte',
  configuracoes: 'Configurações',
  auditoria: 'Auditoria',
  estoque: 'Estoque',
  compras: 'Compras',
  funcionarios: 'Funcionários',
  scans: 'Scans 3D',
  entregas: 'Entregas',
  agenda: 'Agenda',
  kanban: 'Kanban',
  precos: 'Tabela de Preços',
  simulador: 'Simulador',
  planos: 'Plano',
  payroll: 'Folha de Pagamento',
  comissoes: 'Comissões',
  tickets: 'Tickets',
  sugestoes: 'Sugestões',
  boletos: 'Boletos',
  faturamento: 'Faturamento',
  despesas: 'Despesas',
  dre: 'DRE',
  'curva-abc': 'Curva ABC',
};

type Crumb = {
  label: string;
  href: string | null; // null = última posição (não clicável)
};

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return []; // Dashboard — sem breadcrumb

  const crumbs: Crumb[] = [];

  // Verifica se o path completo tem label direto
  const fullLabel = LABEL_MAP[pathname];
  if (fullLabel) {
    if (segments.length === 1) {
      return [{ label: fullLabel, href: null }];
    }
    // path profundo com label direto — constrói hierarquia
    let acc = '';
    for (let i = 0; i < segments.length; i++) {
      acc += '/' + segments[i];
      const seg = segments[i] ?? '';
      const lbl = LABEL_MAP[acc] ?? SEGMENT_LABELS[seg] ?? capitalize(seg);
      const isLast = i === segments.length - 1;
      crumbs.push({ label: lbl, href: isLast ? null : acc });
    }
    return crumbs;
  }

  // path com segmento dinâmico (ex: /trabalhos/123, /clientes/abc)
  let acc = '';
  for (let i = 0; i < segments.length; i++) {
    acc += '/' + segments[i];
    const seg = segments[i] ?? '';
    const isLast = i === segments.length - 1;
    const lbl = LABEL_MAP[acc] ?? SEGMENT_LABELS[seg] ?? (isDynamic(seg) ? seg : capitalize(seg));
    crumbs.push({ label: lbl, href: isLast ? null : acc });
  }

  return crumbs;
}

function isDynamic(segment: string) {
  // heurística: segmento numérico ou UUID = dinâmico (ID de recurso)
  return /^\d+$/.test(segment) || /^[0-9a-f-]{36}$/.test(segment);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ─── Breadcrumb component ─────────────────────────────────── */
export function Breadcrumb() {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);

  // Exibe apenas em rotas com ≥ 2 segmentos (nunca na dashboard /)
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label="Navegação estrutural" className="flex items-center gap-1 text-[12px] text-muted-foreground mb-4">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />}
            {isLast || !crumb.href ? (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={isLast ? 'text-foreground font-medium' : 'hover:text-foreground'}
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.href}
                className="hover:text-foreground transition-colors duration-[80ms] underline-offset-2 hover:underline"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
