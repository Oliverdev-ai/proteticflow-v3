import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  ChartBar,
  FileText,
  Layers,
  Package,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';

const features = [
  {
    icon: Layers,
    title: 'Kanban de Produção',
    description: 'Visualize cada OS por estágio e reduza atrasos no fluxo do laboratório.',
  },
  {
    icon: Users,
    title: 'Portal do Cliente',
    description: 'Compartilhe status das peças com dentistas sem expor dados internos.',
  },
  {
    icon: Bot,
    title: 'Flow IA',
    description: 'Apoio inteligente para análise e produtividade com histórico do seu tenant.',
  },
  {
    icon: FileText,
    title: 'Relatórios PDF',
    description: 'Financeiro, produção e operação com exportação pronta para auditoria.',
  },
  {
    icon: Package,
    title: 'Estoque Integrado',
    description: 'Controle materiais, fornecedores, OC e movimentações sem planilhas paralelas.',
  },
  {
    icon: ShieldCheck,
    title: 'Fiscal e Seguranca',
    description: 'Boletos, NFS-e, trilha de auditoria, rate limit e hardening em produção.',
  },
];

const plans = [
  {
    name: 'Trial',
    price: 'R$ 0',
    period: '30 dias',
    highlight: 'Validação rápida',
    items: ['10 clientes', '30 OS/mês', '2 usuários', '1 tabela de preço'],
  },
  {
    name: 'Starter',
    price: 'R$ 199',
    period: '/mes',
    highlight: 'Labs em crescimento',
    items: ['50 clientes', '200 OS/mês', '5 usuários', 'IA básica'],
  },
  {
    name: 'Pro',
    price: 'R$ 499',
    period: '/mes',
    highlight: 'Escala operacional',
    items: ['Clientes ilimitados', 'Portal cliente', 'API e IA completa', '15 usuários'],
  },
  {
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    highlight: 'Operação multi-unidade',
    items: ['Sem limites', 'SLA dedicado', 'Suporte prioritário', 'Integrações customizadas'],
  },
];

const testimonials = [
  {
    quote: 'Saímos do caos em planilhas para previsibilidade diária de entregas.',
    author: 'Dr. Renan Melo',
    role: 'Prótese Dental Melo',
  },
  {
    quote: 'O portal reduziu chamadas de status e melhorou a confiança dos dentistas.',
    author: 'Dra. Camila Duarte',
    role: 'Clínica Odonto Prime',
  },
  {
    quote: 'Hoje fechamos o financeiro com rastreabilidade completa por OS.',
    author: 'Mariana Lopes',
    role: 'Gestora Operacional',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.20),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]" />

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs mb-6">
          <Stethoscope size={14} />
          SaaS para laboratórios de prótese
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight">
          ProteticFlow
          <span className="block text-primary">
            Gestão inteligente para laboratórios de prótese
          </span>
        </h1>
        <p className="mt-6 max-w-3xl text-zinc-300 text-lg">
          Produção, financeiro, estoque, portal do cliente e IA em uma operação única por tenant.
          Menos retrabalho, mais previsibilidade e entrega com padrão.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary text-white font-semibold transition-colors"
          >
            Comece gratis
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-200 transition-colors"
          >
            Entrar na plataforma
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-8">
          Módulos que cobrem o ciclo inteiro do laboratório
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
            >
              <feature.icon className="text-primary mb-4" size={20} />
              <h3 className="font-semibold text-white">{feature.title}</h3>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <h2 className="text-2xl md:text-3xl font-bold">Planos para cada estágio de operação</h2>
          <span className="text-xs uppercase tracking-widest text-primary">PRD 1.5</span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col"
            >
              <p className="text-xs text-primary uppercase tracking-wide">{plan.highlight}</p>
              <h3 className="text-xl font-bold mt-2">{plan.name}</h3>
              <div className="mt-4 mb-5">
                <span className="text-2xl font-extrabold">{plan.price}</span>
                <span className="text-zinc-400 text-sm ml-1">{plan.period}</span>
              </div>
              <ul className="space-y-2 text-sm text-zinc-300 flex-1">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ChartBar size={14} className="text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 py-2.5 text-sm font-semibold transition-colors"
              >
                Escolher plano
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-8">Quem ja acelerou com ProteticFlow</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {testimonials.map((item) => (
            <article
              key={item.author}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5"
            >
              <p className="text-zinc-200 leading-relaxed">&ldquo;{item.quote}&rdquo;</p>
              <p className="mt-6 text-sm font-semibold">{item.author}</p>
              <p className="text-xs text-zinc-400">{item.role}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/20 to-emerald-500/10 p-8 md:p-10">
          <h2 className="text-2xl md:text-4xl font-black">
            Pronto para transformar seu laboratório?
          </h2>
          <p className="text-zinc-200 mt-3 max-w-2xl">
            Crie sua conta gratuita, configure seu tenant e tenha operação ponta a ponta em poucos
            minutos.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary text-white font-semibold transition-colors"
            >
              Cadastre-se agora
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-zinc-600 hover:border-zinc-400 text-zinc-100 transition-colors"
            >
              Ja tenho acesso
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
          <span>&copy; 2026 ProteticFlow. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-zinc-200 transition-colors">
              Login
            </Link>
            <Link to="/register" className="hover:text-zinc-200 transition-colors">
              Registro
            </Link>
            <Link to="/landing" className="hover:text-zinc-200 transition-colors">
              Landing
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
