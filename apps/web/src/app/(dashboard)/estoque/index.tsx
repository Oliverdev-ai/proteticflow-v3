import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import {
  ShoppingCart, TrendingUp, BarChart3,
  ArrowUpRight, Box, History, Settings2,
  PackageCheck, Package, AlertTriangle,
} from 'lucide-react';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle } from '../../../components/shared/typography';
import { cn } from '../../../lib/utils';

function SummaryCard({ icon: Icon, label, value, sub, accent = false, color = "primary" }: {
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  sub?: string; 
  accent?: boolean;
  color?: "primary" | "red" | "emerald" | "orange";
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary border-primary/20",
    red: "bg-destructive/10 text-destructive border-destructive/20",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  return (
    <div className={cn(
      "premium-card p-6 flex flex-col gap-6 group hover:border-primary/30 transition-all",
      accent && color === "red" && "border-destructive/40 shadow-lg shadow-destructive/5"
    )}>
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", colorMap[color])}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className={cn("text-3xl font-black tracking-tighter", accent && color === "red" ? "text-destructive" : "text-foreground")}>
          {value}
        </p>
        {sub && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className={cn("w-1 h-1 rounded-full", accent ? "bg-destructive animate-pulse" : "bg-muted-foreground/30")} />
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{sub}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  { label: 'Catálogo de Materiais', href: '/estoque/materiais', desc: 'Controle de saldo, lotes e validade', icon: Box, color: 'text-primary', bg: 'bg-primary/10' },
  { label: 'Gestão de Fornecedores', href: '/estoque/fornecedores', desc: 'Base de dados e contatos comerciais', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Ordens de Compra', href: '/estoque/ordens-compra', desc: 'Fluxo de aquisições e recebimentos', icon: ShoppingCart, color: 'text-orange-500', bg: 'bg-orange-500/10' },
];

export default function InventoryDashboard() {
  const { data: dash, isLoading, error } = trpc.inventory.getDashboard.useQuery();

  const totalValue = dash ? (dash.totalValueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
            <Package size={28} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col gap-0.5">
            <H1 className="tracking-tight">Estoque & Materiais</H1>
            <Subtitle>Controle inteligente de insumos e cadeia de suprimentos</Subtitle>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            to="/estoque/materiais"
            className="flex items-center gap-3 px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95"
          >
            <PackageCheck size={16} strokeWidth={3} /> Gerenciar Materiais
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={18} />
          Erro na conexão: {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
           {[1,2,3,4].map(i => <div key={i} className="h-40 bg-muted/50 rounded-[32px] border border-border/50" />)}
        </div>
      ) : (
        <ScaleIn className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard icon={Box} label="Itens em Catálogo" value={dash?.totalMaterials ?? 0} color="primary" />
          <SummaryCard 
            icon={AlertTriangle} 
            label="Insumos Críticos" 
            value={dash?.belowMinimum ?? 0} 
            sub="Abaixo do estoque mínimo" 
            accent={(dash?.belowMinimum ?? 0) > 0} 
            color={(dash?.belowMinimum ?? 0) > 0 ? "red" : "primary"}
          />
          <SummaryCard icon={BarChart3} label="Patrimônio em Estoque" value={totalValue} color="emerald" />
          <SummaryCard 
            icon={ShoppingCart} 
            label="OCs em Aberto" 
            value={dash?.pendingPOs ?? 0} 
            sub="Aguardando recebimento" 
            accent={(dash?.pendingPOs ?? 0) > 0} 
            color={(dash?.pendingPOs ?? 0) > 0 ? "orange" : "primary"}
          />
        </ScaleIn>
      )}

      {/* Quick access sections */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
           <History size={18} className="text-primary" />
           <h2 className="text-xs font-black uppercase tracking-[0.3em] text-foreground">Operações Rápidas</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {QUICK_LINKS.map(({ label, href, desc, icon: Icon, color, bg }) => (
            <Link
              key={href}
              to={href}
              className="premium-card p-8 group relative overflow-hidden flex flex-col gap-6 hover:border-primary/50 transition-all border-dashed"
            >
              <div className="flex items-center justify-between">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-all group-hover:scale-110 group-hover:rotate-3", bg, color)}>
                  <Icon size={28} strokeWidth={2.5} />
                </div>
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                  <ArrowUpRight size={20} strokeWidth={3} />
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-black text-foreground tracking-tight group-hover:text-primary transition-colors">{label}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed opacity-60">
                  {desc}
                </p>
              </div>
              
              {/* Subtle background decoration */}
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>

      {/* Extra tools / Quick action banner */}
      {!isLoading && (dash?.totalMaterials ?? 0) === 0 && (
        <div className="mt-4 p-8 bg-primary/5 border-2 border-dashed border-primary/20 rounded-[40px] flex flex-col items-center text-center gap-4 animate-in zoom-in-95">
           <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary/40">
              <Settings2 size={32} />
           </div>
           <div className="max-w-md space-y-2">
             <p className="text-sm font-black uppercase tracking-widest text-primary">Estoque Vazio</p>
             <Subtitle>Comece cadastrando seus materiais básicos para habilitar alertas inteligentes e previsões de consumo.</Subtitle>
           </div>
           <Link to="/estoque/materiais" className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:underline underline-offset-4">Configurar agora</Link>
        </div>
      )}
    </PageTransition>
  );
}
