# ProteticFlow v3 — Documento Técnico Definitivo
## PRD + Arquitetura + Plano de Execução + Padrões de Qualidade

**Versão:** 3.3 (padrões mandatórios, anti-patterns de concorrência, apêndice B)  
**Data:** 20 de Março de 2026  
**Fontes:** PRD v2.1 (289 requisitos), Plano Enterprise, auditoria de código (branches dev + proteticflow_Manus + ZIPs), análise de regressão (28 bugs)  
**Propósito:** Documento único e definitivo para a construção do ProteticFlow. Nada fora deste documento existe como requisito.  
**Supersede:** Este documento substitui TODOS os anteriores: PRD v2.1, Plano Enterprise (9 fases), documentação DentalFlow, análise LabFácil. Se houver conflito entre este documento e qualquer outro, **este documento prevalece**.  
**Numeração canônica:** 28 fases (Fase 1 a 28) + 2 pós-lançamento (29-30). Qualquer referência a "Fase 0" ou a fases de outro documento é obsoleta.  
**Módulos:** 27 | **Requisitos:** 289 | **Fases:** 28 (+2 pós-lançamento)

---

## CONTEXTO

**Produto:** Sistema SaaS de gestão para laboratórios de prótese dentária. Primeiro do Brasil com IA embarcada.  
**Concorrente direto:** LabFácil (UrgtTec). ProteticFlow iguala todas as funcionalidades e supera em IA, Kanban, Portal do Cliente, Push Notifications e Scans 3D.  
**Equipe:** 1 coordenador humano + 4 agentes IA (Claude, Claude Code, Antigravity, Codex).  
**Decisão arquitetural:** Migração incremental do proteticflow-ui com upgrade de stack. O legado Django (56 models, 1561 campos) serve como especificação funcional de profundidade de dados. O proteticflow-ui é a base de código — sua lógica de negócio pura (cálculos financeiros, parsers XML, engine de PDF, machine de estados do Kanban) é reaproveitada. O que é **reescrito**: camada de dados (queries sem tenant filter → queries com tenant obrigatório), autenticação (Manus OAuth → JWT próprio), driver de banco (MySQL → PostgreSQL), e infraestrutura (monorepo Turborepo). O que é **migrado**: services, componentes de UI, testes de lógica de negócio.

### Princípios Inegociáveis

1. **TypeScript strict de ponta a ponta.** Zero `.js`. Zero `any`.
2. **Multi-tenancy real.** Toda query de negócio filtrada por `tenantId`. Teste automatizado no CI que quebra se alguém esquecer.
3. **Módulo completo ou módulo inexistente.** Schema → Service → Router → Testes → Página → Sidebar link. Sem meias implementações.
4. **Segurança por padrão.** RBAC em toda rota. Limites de plano em todo create. Audit log em toda escrita. Segredos fora do repo.
5. **Qualidade contínua.** CI bloqueia merge se testes falham, types quebram, ou cobertura cai abaixo do mínimo.
6. **Django como referência de profundidade.** O Manus tinha Employee com 12 campos. O Django tem 35. Usar Django como piso de completude.
7. **Manus como referência de elegância.** Estados loading/empty/error, animações, transições. Sem páginas "cruas".
8. **Integrações via gateway.** Boletos via Asaas/PagHiper. NFS-e via Focus NFe/eNotas. LLM via API direta (Anthropic/OpenAI). Sem intermediários.

---

## PARTE 1 — DECISÕES ARQUITETURAIS

### 1.1 Stack Definitiva

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Runtime** | Node.js 22 LTS | Runtime único. Sem split Python/Node. |
| **Linguagem** | TypeScript 5.x (strict mode) | Type safety ponta a ponta. Todo arquivo `.ts` ou `.tsx`, zero `.js`. |
| **Backend framework** | Express + tRPC v11 | Já validado no proteticflow-ui. Para 10-100 usuários simultâneos, o gargalo é o banco, não o framework HTTP. Migrar para Fastify quando houver evidência de gargalo (ver nota abaixo). |
| **Frontend framework** | React 19 + Vite 7 | SPA com code-splitting. Sem SSR (desnecessário para SaaS B2B com login). |
| **ORM** | Drizzle ORM (PostgreSQL driver) | TypeScript-native, migrations versionadas, zero overhead de runtime. |
| **Banco de dados** | PostgreSQL 16 | Superior a MySQL para SaaS: JSONB nativo, full-text search em português (`pg_trgm`), row-level security, extensões. Requer migração de schema do Drizzle MySQL (ver seção 2.9). |
| **Jobs assíncronos** | node-cron (lançamento) → BullMQ (escala) | Para 50-500 OS/mês, `node-cron` é suficiente para fechamento mensal e lembretes. Sem Redis adicional no dia 1. BullMQ + Redis adicionado quando volume justificar (>1000 OS/mês ou necessidade de retry/dead-letter). |
| **Autenticação** | JWT próprio (jose) + bcrypt | Sem dependência de terceiros. Access token (15min) + refresh token (7d) em httpOnly cookie. |
| **2FA** | otplib + qrcode | TOTP compatível com Google Authenticator / Authy. |
| **Validação** | Zod v4 | Schema validation compartilhado entre front e back via tRPC. |
| **UI Components** | shadcn/ui + Radix UI + Tailwind CSS 4 | Componentes acessíveis, customizáveis, sem lock-in de biblioteca. |
| **Gráficos** | Recharts | Já validado nas versões anteriores. |
| **Drag & Drop** | dnd-kit | Kanban. Já validado na versão Manus. |
| **Animações** | framer-motion | Transições suaves. Já validado na versão Manus. |
| **PDF** | jsPDF + autoTable (client) + @react-pdf/renderer (server) | Geração client-side para uso rápido, server-side para relatórios pesados e envio por email. |
| **Email** | Resend ou Nodemailer | Transacional (verificação, convites, relatórios). |
| **Storage (arquivos)** | S3-compatible (MinIO dev, AWS S3 prod) | Upload de fotos, scans STL/XML, logos. |
| **LLM / IA** | Anthropic Claude API (primário) + OpenAI (fallback) | Chamada direta à API. Sem intermediários (sem Manus Forge). |
| **Testes** | Vitest (unit/integration) + Playwright (E2E) | Vitest é nativo do ecossistema Vite. Playwright é mais robusto que Cypress. |
| **Monorepo** | Turborepo | Build paralelo, cache inteligente, workspace com pacotes compartilhados. |
| **Deploy** | Docker Compose (dev/staging) → Railway ou Render (prod) | Containerizado. Sem vendor lock-in pesado. |
| **CI/CD** | GitHub Actions | Build, test, deploy automáticos. |
| **Observabilidade** | Pino (logs) + Sentry (erros) | Pino via pino-http. Estruturado, rápido, JSON nativo. Sentry para crash reporting. |

### 1.2 Estrutura de Pastas (Monorepo)

```
proteticflow/
├── apps/
│   ├── web/                          # Frontend React + Vite
│   │   ├── src/
│   │   │   ├── app/                  # Rotas e layouts (React Router v7)
│   │   │   │   ├── (auth)/           # Grupo de rotas públicas
│   │   │   │   │   ├── login.tsx
│   │   │   │   │   ├── register.tsx
│   │   │   │   │   └── forgot-password.tsx
│   │   │   │   ├── (dashboard)/      # Grupo de rotas autenticadas
│   │   │   │   │   ├── layout.tsx    # Layout com sidebar + header
│   │   │   │   │   ├── dashboard.tsx
│   │   │   │   │   ├── clientes/
│   │   │   │   │   │   ├── index.tsx       # Listagem
│   │   │   │   │   │   ├── novo.tsx        # Criação
│   │   │   │   │   │   └── [id].tsx        # Edição
│   │   │   │   │   ├── trabalhos/
│   │   │   │   │   ├── kanban.tsx
│   │   │   │   │   ├── financeiro/
│   │   │   │   │   ├── estoque/
│   │   │   │   │   ├── funcionarios/
│   │   │   │   │   ├── entregas.tsx
│   │   │   │   │   ├── comissoes.tsx
│   │   │   │   │   ├── relatorios/
│   │   │   │   │   ├── scans.tsx
│   │   │   │   │   ├── agenda.tsx
│   │   │   │   │   ├── simulador.tsx
│   │   │   │   │   ├── fiscal/
│   │   │   │   │   │   ├── boletos.tsx
│   │   │   │   │   │   └── notas-fiscais.tsx
│   │   │   │   │   ├── suporte/
│   │   │   │   │   │   ├── tickets.tsx
│   │   │   │   │   │   └── chatbot-config.tsx
│   │   │   │   │   ├── configuracoes/
│   │   │   │   │   └── planos.tsx
│   │   │   │   ├── portal/           # Portal do cliente (público, sem sidebar)
│   │   │   │   │   └── [token].tsx
│   │   │   │   └── onboarding.tsx    # Wizard pós-registro
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn/ui (gerados)
│   │   │   │   ├── layout/
│   │   │   │   │   ├── sidebar.tsx
│   │   │   │   │   ├── header.tsx
│   │   │   │   │   ├── tenant-switcher.tsx
│   │   │   │   │   └── license-banner.tsx
│   │   │   │   ├── ai/
│   │   │   │   │   └── flow-assistant.tsx
│   │   │   │   └── shared/           # Componentes reutilizáveis de negócio
│   │   │   ├── hooks/
│   │   │   │   ├── use-auth.ts
│   │   │   │   ├── use-permissions.ts
│   │   │   │   ├── use-license.ts
│   │   │   │   └── use-tenant.ts
│   │   │   ├── lib/
│   │   │   │   ├── trpc.ts           # Client tRPC tipado
│   │   │   │   └── utils.ts
│   │   │   └── styles/
│   │   │       └── globals.css       # Tailwind base + tokens do design system
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── server/                       # Backend Express + tRPC
│       ├── src/
│       │   ├── core/
│       │   │   ├── server.ts         # Instância Express + tRPC adapter
│       │   │   ├── trpc.ts           # Inicialização tRPC + middlewares base
│       │   │   ├── context.ts        # Context factory (resolve user + tenant)
│       │   │   ├── auth.ts           # JWT sign/verify, bcrypt, 2FA
│       │   │   ├── errors.ts         # Error classes padronizadas
│       │   │   ├── env.ts            # Validação de env vars com Zod
│       │   │   └── logger.ts         # Configuração Pino
│       │   ├── middleware/
│       │   │   ├── tenant.ts         # Resolve tenantId no contexto — OBRIGATÓRIO
│       │   │   ├── rbac.ts           # Role-based access por procedure
│       │   │   ├── license.ts        # Verifica limites do plano antes de create
│       │   │   └── rate-limit.ts     # Rate limiting por tenant
│       │   ├── modules/              # UM diretório por módulo de negócio
│       │   │   ├── auth/
│       │   │   │   ├── router.ts     # Procedures: login, register, refresh, logout, setup2fa, verify2fa
│       │   │   │   ├── service.ts    # Lógica de negócio
│       │   │   │   └── auth.test.ts
│       │   │   ├── tenants/
│       │   │   │   ├── router.ts     # Procedures: create, list, switch, update, members, invite
│       │   │   │   ├── service.ts
│       │   │   │   └── tenants.test.ts
│       │   │   ├── clients/
│       │   │   │   ├── router.ts
│       │   │   │   ├── service.ts
│       │   │   │   └── clients.test.ts
│       │   │   ├── jobs/
│       │   │   │   ├── router.ts     # CRUD + status machine + kanban
│       │   │   │   ├── service.ts
│       │   │   │   ├── photos.ts     # Sub-router para fotos
│       │   │   │   └── jobs.test.ts
│       │   │   ├── pricing/
│       │   │   │   ├── router.ts     # CRUD + reajuste + import/export CSV
│       │   │   │   ├── service.ts
│       │   │   │   └── pricing.test.ts
│       │   │   ├── financial/
│       │   │   │   ├── router.ts     # AR, AP, closings, delivery schedules
│       │   │   │   ├── service.ts
│       │   │   │   ├── tasks.ts      # Cron jobs: fechamento mensal, lembretes
│       │   │   │   └── financial.test.ts
│       │   │   ├── inventory/
│       │   │   │   ├── router.ts     # Materials, movements, suppliers, purchase orders
│       │   │   │   ├── service.ts
│       │   │   │   └── inventory.test.ts
│       │   │   ├── employees/
│       │   │   │   ├── router.ts     # CRUD + skills + assignments + commissions
│       │   │   │   ├── service.ts
│       │   │   │   └── employees.test.ts
│       │   │   ├── payroll/
│       │   │   │   ├── router.ts     # Periods, entries, generate, close
│       │   │   │   ├── service.ts
│       │   │   │   └── payroll.test.ts
│       │   │   ├── scans/
│       │   │   │   ├── router.ts     # Upload STL/XML, send to printer
│       │   │   │   ├── xml-parser.ts
│       │   │   │   └── scans.test.ts
│       │   │   ├── ai/
│       │   │   │   ├── router.ts     # Chat, commands, sessions
│       │   │   │   ├── flow-engine.ts      # Command processor + LLM integration
│       │   │   │   ├── scheduling.ts       # Agendamento inteligente
│       │   │   │   ├── predictions.ts      # Analytics preditivo
│       │   │   │   ├── smart-orders.ts     # Sugestões de OS
│       │   │   │   └── ai.test.ts
│       │   │   ├── portal/
│       │   │   │   ├── router.ts     # Token-based public access
│       │   │   │   ├── service.ts
│       │   │   │   └── portal.test.ts
│       │   │   ├── reports/
│       │   │   │   ├── router.ts
│       │   │   │   ├── pdf-engine.ts # Geração server-side
│       │   │   │   └── reports.test.ts
│       │   │   ├── notifications/
│       │   │   │   ├── router.ts     # In-app + push + email
│       │   │   │   ├── push.ts       # VAPID + web-push
│       │   │   │   ├── email.ts      # Templates + envio
│       │   │   │   └── notifications.test.ts
│       │   │   ├── licensing/
│       │   │   │   ├── router.ts     # Plan management, limits, enforcement
│       │   │   │   ├── service.ts
│       │   │   │   ├── stripe.ts     # Webhook handler + checkout
│       │   │   │   └── licensing.test.ts
│       │   │   ├── settings/
│       │   │   │   ├── router.ts     # Lab settings, logo, SMTP config
│       │   │   │   ├── service.ts
│       │   │   │   └── settings.test.ts
│       │   │   ├── fiscal/
│       │   │   │   ├── router.ts     # Boletos + NFS-e
│       │   │   │   ├── boleto.ts     # Integração gateway de boleto (Asaas/PagHiper)
│       │   │   │   ├── nfse.ts       # Integração NFS-e (Focus NFe/eNotas)
│       │   │   │   ├── service.ts
│       │   │   │   └── fiscal.test.ts
│       │   │   ├── agenda/
│       │   │   │   ├── router.ts     # Eventos, calendário, recorrência
│       │   │   │   ├── service.ts
│       │   │   │   └── agenda.test.ts
│       │   │   ├── support/
│       │   │   │   ├── router.ts     # Chatbot dentista, tickets, templates
│       │   │   │   ├── chatbot.ts    # Engine de chatbot + intent detection
│       │   │   │   ├── whatsapp.ts   # Integração WhatsApp Business (pós-lançamento)
│       │   │   │   ├── service.ts
│       │   │   │   └── support.test.ts
│       │   │   ├── simulator/
│       │   │   │   ├── router.ts     # Simulação de orçamento, conversão para OS
│       │   │   │   ├── service.ts
│       │   │   │   └── simulator.test.ts
│       │   │   └── dashboard/
│       │   │       ├── router.ts     # KPIs aggregation
│       │   │       ├── service.ts
│       │   │       └── dashboard.test.ts
│       │   ├── db/
│       │   │   ├── index.ts          # Connection pool (pg + drizzle)
│       │   │   ├── schema.ts         # Drizzle schema completo (TODAS as tabelas)
│       │   │   ├── migrate.ts        # Runner de migrations
│       │   │   └── seed.ts           # Dados de demonstração
│       │   ├── cron/                  # Scheduled jobs (node-cron)
│       │   │   ├── scheduler.ts       # Registro de todos os cron jobs
│       │   │   ├── monthly-closing.ts
│       │   │   ├── overdue-reminders.ts
│       │   │   ├── deadline-alerts.ts
│       │   │   └── trial-expiration.ts
│       │   └── index.ts              # Entry point
│       ├── drizzle/
│       │   └── migrations/           # Migrations versionadas (geradas por drizzle-kit)
│       ├── drizzle.config.ts
│       ├── tsconfig.json
│       └── vitest.config.ts
│
├── packages/
│   └── shared/                       # Código compartilhado front + back
│       ├── src/
│       │   ├── types/                # Tipos de domínio compartilhados
│       │   │   ├── client.ts
│       │   │   ├── job.ts
│       │   │   ├── employee.ts
│       │   │   └── ...
│       │   ├── constants/
│       │   │   ├── roles.ts          # Enum de roles e permissões
│       │   │   ├── job-status.ts     # Status machine do trabalho
│       │   │   ├── plans.ts          # Definição de planos e limites
│       │   │   └── ...
│       │   ├── validation/           # Schemas Zod compartilhados
│       │   │   ├── client.schema.ts
│       │   │   ├── job.schema.ts
│       │   │   └── ...
│       │   └── utils/
│       │       ├── format.ts         # Formatação BR (moeda, CPF, CNPJ, telefone)
│       │       ├── date.ts           # Helpers de data (fuso horário BR)
│       │       └── slug.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docker/
│   ├── docker-compose.yml            # Dev: Postgres + MinIO
│   ├── docker-compose.prod.yml       # Prod: Node + Postgres + Nginx (+ Redis quando escalar)
│   ├── Dockerfile.server
│   └── Dockerfile.web
│
├── docs/
│   ├── PRD.md                        # Este documento
│   ├── ARCHITECTURE.md               # Decisões arquiteturais (ADRs)
│   ├── API.md                        # Auto-gerado via tRPC
│   └── DEPLOY.md                     # Guia de deploy
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + Type check + Test + Build
│       └── deploy.yml                # Deploy staging/prod
│
├── turbo.json                        # Turborepo config
├── package.json                      # Workspace root
├── .env.example                      # Template de variáveis (NUNCA commitar .env real)
├── .gitignore                        # Inclui .env*, dist/, node_modules/, *.pid, *.log
└── README.md
```

### 1.3 Multi-Tenancy — Regra Inviolável

**Cada query que toca dados de negócio DEVE filtrar por `tenantId`.** Sem exceção.

A implementação se dá em 3 camadas:

**Camada 1 — Context:** Toda request autenticada resolve `tenantId` no contexto tRPC antes de chegar ao router. Se o usuário não tem tenant ativo, a request é rejeitada.

```typescript
// core/context.ts — resolve tenantId ou rejeita
export async function createContext({ req }) {
  const user = await verifyToken(req);
  if (!user) return { user: null, tenantId: null };
  
  const tenantId = await resolveActiveTenantId(user.id);
  if (!tenantId) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Selecione um laboratório' });
  
  const membership = await getTenantMembership(user.id, tenantId);
  return { user, tenantId, role: membership.role };
}
```

**Camada 2 — Query helpers:** Toda função de acesso a dados recebe `tenantId` como primeiro parâmetro. Não é opcional.

```typescript
// modules/clients/service.ts — tenantId é obrigatório
export async function listClients(tenantId: number, filters?: ClientFilters) {
  return db.select().from(clients)
    .where(and(
      eq(clients.tenantId, tenantId),  // SEMPRE presente
      filters?.status ? eq(clients.status, filters.status) : undefined
    ));
}
```

**Camada 3 — Teste automatizado:** Um teste global verifica que nenhuma query de negócio é feita sem filtro de `tenantId`. Se alguém adicionar uma query sem filtro, o CI quebra.

### 1.4 RBAC — 5 Roles com Permissões Granulares

```typescript
// packages/shared/src/constants/roles.ts
export const ROLES = {
  superadmin: {
    label: 'Administrador',
    modules: ['*'], // acesso total
  },
  gerente: {
    label: 'Gerente',
    modules: ['dashboard', 'clients', 'jobs', 'kanban', 'financial', 'inventory', 
              'employees', 'payroll', 'reports', 'scans', 'deliveries', 'commissions',
              'settings', 'portal', 'ai'],
  },
  producao: {
    label: 'Linha de Produção',
    modules: ['dashboard', 'jobs', 'kanban', 'scans', 'inventory.consume'],
    // Pode ver e mover trabalhos no kanban, consumir material do estoque.
    // Não vê financeiro, não cria clientes, não exclui nada.
  },
  recepcao: {
    label: 'Recepção',
    modules: ['dashboard', 'clients', 'jobs.create', 'jobs.view', 'deliveries', 'pricing.view'],
    // Pode criar clientes e OS, visualizar entregas e preços.
    // Não vê financeiro, não move kanban, não gerencia estoque.
  },
  contabil: {
    label: 'Contábil',
    modules: ['dashboard', 'financial', 'reports', 'payroll'],
    // Só vê números. Não toca em clientes, trabalhos ou estoque.
  },
} as const;
```

### 1.5 Licenciamento — 4 Planos

```typescript
// packages/shared/src/constants/plans.ts
export const PLANS = {
  trial: {
    label: 'Teste Grátis',
    price: 0,
    duration: 30, // dias
    limits: { clients: 10, jobsPerMonth: 30, users: 2, priceTables: 1, storage: 500 }, // MB
    features: { reports: false, portal: false, ai: false, api: false, support: 'community' },
  },
  starter: {
    label: 'Starter',
    price: 9700, // centavos (R$ 97)
    limits: { clients: 50, jobsPerMonth: 200, users: 5, priceTables: 3, storage: 2000 },
    features: { reports: true, portal: false, ai: 'basic', api: false, support: 'email' },
  },
  pro: {
    label: 'Profissional',
    price: 19700, // centavos (R$ 197)
    limits: { clients: 500, jobsPerMonth: null, users: 15, priceTables: null, storage: 10000 },
    features: { reports: true, portal: true, ai: 'full', api: true, support: 'priority' },
  },
  enterprise: {
    label: 'Enterprise',
    price: null, // sob consulta
    limits: { clients: null, jobsPerMonth: null, users: null, priceTables: null, storage: null },
    features: { reports: true, portal: true, ai: 'full', api: true, support: 'dedicated' },
  },
} as const;
```

### 1.6 Fluxo de Background Jobs

**Fase de lançamento:** `node-cron` (sem dependência externa, roda no mesmo processo Node.js)  
**Fase de escala (>1000 OS/mês):** Migrar para BullMQ + Redis (workers separados, retry, dead-letter queues)

| Job | Frequência | Descrição |
|-----|-----------|-----------|
| `monthly-closing` | Dia 1, 6h | Gera fechamento financeiro mensal por tenant |
| `overdue-reminders` | Diário, 8h | Envia email para clientes com contas vencidas |
| `deadline-alerts` | A cada hora | Notifica push + in-app sobre trabalhos com prazo em 24h |
| `report-generation` | Sob demanda | Gera PDFs de forma assíncrona (async function, não fila) |
| `trial-expiration` | Diário, 0h | Verifica trials expirados e notifica |

> **Quando migrar para BullMQ:** Se jobs demorarem >30s e impactarem a responsividade da API, ou se precisar de retry com backoff exponencial, ou se tiver >1000 OS/mês com múltiplos tenants gerando fechamentos simultâneos.

---

## PARTE 2 — PADRÕES DE QUALIDADE E ENGENHARIA

### 2.1 Quality Gates (aplicados automaticamente no CI)

Nenhum PR é mergeado se qualquer gate falhar. Sem exceções. Sem "depois eu arrumo".

| Gate | Critério | Ferramenta |
|------|---------|-----------|
| **Type safety** | Zero erros `tsc --noEmit` | TypeScript compiler |
| **Lint** | Zero warnings ESLint (config strict) | ESLint + Prettier |
| **Testes unitários backend** | Cobertura ≥ 80% por módulo | Vitest |
| **Testes unitários frontend** | Cobertura ≥ 70% em componentes com lógica | Vitest + Testing Library |
| **Testes E2E** | 100% dos fluxos críticos passando | Playwright |
| **Tenant isolation** | Teste automático verifica que TODA query de negócio filtra por `tenantId` | Script custom no CI |
| **RBAC coverage** | Toda rota tem permission middleware explícito | Teste que lista rotas sem middleware |
| **Secrets scan** | Zero segredos no código ou no histórico | gitleaks |
| **Dependency audit** | Zero vulnerabilidades críticas | npm audit |
| **Build** | Build de produção completa sem erros | Vite + esbuild |

### 2.2 Métricas de Performance (SLOs)

| Métrica | Target | Medição |
|---------|--------|---------|
| API p95 latency (queries simples) | ≤ 200ms | Pino request logging |
| API p95 latency (queries complexas: relatórios, dashboard) | ≤ 500ms | Pino request logging |
| Taxa de erro 5xx | < 0.5% em janela de 7 dias | Sentry + Prometheus |
| Time to Interactive (frontend) | ≤ 3s em 4G | Lighthouse CI |
| Build time | ≤ 3min (CI completo) | GitHub Actions |

### 2.3 Critério de Módulo Concluído (Definition of Done)

Um módulo só é considerado "pronto" e mergeado na main quando atende TODOS os critérios:

**Funcional:**
- [ ] Schema Drizzle criado com tenantId em toda tabela de negócio
- [ ] Migration gerada e executável (`pnpm db:push`)
- [ ] Service layer com funções tipadas (recebe tenantId como primeiro parâmetro)
- [ ] Router tRPC com procedures usando middleware correto (RBAC + licensedProcedure)
- [ ] Página frontend funcional com estados: loading, empty, error, success
- [ ] Link na sidebar com ícone (respeitando RBAC — só aparece para roles autorizados)
- [ ] Zod schemas compartilhados em `packages/shared` para validação front+back

**Qualidade:**
- [ ] Testes: mínimo create, list, update, delete + teste de RBAC (role sem permissão recebe FORBIDDEN) + teste de tenant isolation
- [ ] Sem `any` no TypeScript
- [ ] CI verde

**Observabilidade (ver seção 2.9 para detalhes):**
- [ ] Logs estruturados em toda operação de escrita (`{ action, tenantId, userId, entityId }`)
- [ ] Pelo menos 1 métrica de negócio exposta (counter, gauge ou histogram)
- [ ] Pelo menos 1 alerta configurado para condição anômala do módulo

**Handoff (ver seção 2.8):**
- [ ] Nota de handoff no PR description
- [ ] Regressão zero confirmada (testes de fases anteriores passando)

### 2.4 Estratégia de Uso do Legado

O código antigo (Django + Manus) serve como **referência**, não como base:

| Fonte | Usar para | Não usar para |
|-------|----------|--------------|
| Django models (56 models, 1561 campos) | Profundidade de campos, regras de cálculo (comissão, custo médio), tipos brasileiros (CLT/PJ, CPF/CNPJ) | Copiar código Python. A lógica é reimplementada em TypeScript. |
| Django command_processor (18 comandos) | Lista de comandos da IA Flow, padrões regex, mensagens de resposta | Arquitetura de processamento. No novo sistema a IA chama procedures tRPC tipadas. |
| Manus .tsx pages (Kanban, Estoque, FlowIA, Portal) | Referência visual, padrão de UX, componentes shadcn/ui, animações framer-motion | Copiar componentes diretamente. O novo frontend usa React Router v7, não wouter. |
| Manus Drizzle schema | Estrutura de tabelas multi-tenant, indexes | As queries. O schema antigo usava MySQL. O novo usa PostgreSQL. |

### 2.5 Gestão de Risco

| Risco | Mitigação |
|-------|----------|
| Escopo creep ("só mais uma feature") | PRD congelado. Qualquer adição vira issue para próximo ciclo. |
| Regressão ao adicionar módulo | Testes E2E dos fluxos críticos rodam em todo PR. |
| Vazamento de dados entre tenants | Teste automatizado no CI + audit log de queries. |
| Dependência de API externa (Stripe, NFS-e) | Mock contratual para desenvolvimento. Integração real só na fase de comercialização. |
| Agente IA gerando código inconsistente | Todo código passa por review humano antes de merge. CI é a última barreira. |
| Perda de funcionalidade do legado | Checklist de paridade: cada módulo novo é validado contra a lista de 289 requisitos antes de ser marcado como concluído. |

### 2.6 Padrões de Implementação Mandatórios

> Consultar antes de implementar qualquer módulo. Exemplos em TypeScript real.

**PAD-01: Operações atômicas em dados numéricos (estoque/financeiro)**
```typescript
// ❌ ERRADO — race condition se dois requests simultâneos
const item = await db.select().from(stockItems).where(eq(stockItems.id, id)).limit(1);
await db.update(stockItems).set({ quantity: item[0].quantity - requested }).where(eq(stockItems.id, id));

// ✅ CORRETO — UPDATE atômico com verificação
const result = await db.update(stockItems)
  .set({ quantity: sql`${stockItems.quantity} - ${requested}` })
  .where(and(eq(stockItems.id, id), gte(stockItems.quantity, requested)))
  .returning({ newQty: stockItems.quantity });
if (!result.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Estoque insuficiente' });
```

**PAD-02: Transações para operações compostas**
```typescript
// SEMPRE que tocar mais de uma tabela:
const result = await db.transaction(async (tx) => {
  const ar = await tx.update(accountsReceivable).set({ paidAt: new Date(), status: 'paid' })...;
  await tx.insert(cashbookEntries).values({ type: 'credit', amount: ar.amount, ... });
  return ar;
});
```

**PAD-03: Soft delete — padrão único para todo o sistema**
```typescript
// packages/shared/src/db/mixins.ts — TODOS os módulos importam isso
export const softDeleteColumns = {
  deletedAt: timestamp('deleted_at'),
  deletedBy: integer('deleted_by').references(() => users.id),
};
// Listagens SEMPRE filtram: .where(isNull(table.deletedAt))
// Delete NUNCA usa DELETE FROM — sempre UPDATE SET deletedAt = now()
```

**PAD-04: IDs sequenciais — NUNCA COUNT(*)+1**
```typescript
// ❌ Race condition garantida sob carga
const count = await db.select({ cnt: count() }).from(jobs);
const jobNumber = `OS-${count.cnt + 1}`;

// ✅ Serial autoincrement ou counter com lock
jobNumber: serial('job_number').notNull(),
// Ou para número único por tenant: tabela de counters com SELECT FOR UPDATE
```

**PAD-05: Validação numérica — sempre restringir range**
```typescript
// ❌ Aceita valores negativos — bug financeiro
z.number()

// ✅ Restrição explícita com mensagem em PT-BR
z.number().positive({ message: 'Valor deve ser positivo' })
z.number().int().min(0, { message: 'Quantidade não pode ser negativa' })
```

**PAD-06: Paginação — cursor-based para alto volume**
```typescript
// Para: jobs, financial_transactions, audit_events, stock_movements (> 10k rows)
const listInput = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
// Offset pagination permitida apenas para: clientes, funcionários, tabelas de preços
```

**PAD-07: RBAC — regra de seleção de procedure**
```typescript
// Checklist antes de criar qualquer procedure tRPC:
// → publicProcedure:      apenas portal do cliente (acesso via token)
// → protectedProcedure:   qualquer usuário autenticado
// → adminProcedure:       admin/gerente do tenant
// → superadminProcedure:  operador global do SaaS
// → Delete, configurações, gestão de usuários → SEMPRE adminProcedure
```

**PAD-08: Logging — sempre incluir contexto de negócio**
```typescript
// ✅ Com contexto — útil em produção
logger.info({ tenantId, userId, action: 'job.create', jobId }, 'Job created');

// ❌ Sem contexto — inútil
logger.info('Job created');
```

### 2.7 Migração e Reconciliação de Dados do Legado

O sistema novo parte de banco vazio. Laboratórios que já usam planilhas, outros sistemas ou versões anteriores do ProteticFlow precisam migrar dados. A migração acontece **por domínio**, na mesma ordem das fases de implementação.

**Princípios de migração:**

| Princípio | Detalhe |
|-----------|---------|
| **Migração por domínio, não big-bang** | Clientes primeiro, depois trabalhos, depois financeiro. Cada domínio migrado e validado antes do próximo. |
| **Script idempotente por domínio** | Rodar 2x produz o mesmo resultado. Cada registro migrado tem `legacyId` para rastreabilidade. |
| **Validação de reconciliação** | Após migrar financeiro: soma de ARs no sistema antigo = soma no novo. Diferença > 0.01 bloqueia. |
| **Rollback documentado** | Cada script de migração tem script de rollback correspondente. Testado antes de rodar em produção. |
| **Janela de coexistência** | Durante migração, sistema antigo fica em read-only. Sistema novo recebe escrita. Sem operação simultânea em dois sistemas. |
| **Dados históricos preservados** | OS concluídas, fechamentos passados e movimentações de estoque são migrados como registros históricos, não recriados. |

**Estrutura de scripts:**
```
apps/server/src/migration/
├── 01-clients.ts        # Migra clientes + endereços
├── 02-pricing.ts        # Migra tabelas de preços + itens
├── 03-jobs.ts           # Migra OS + itens + logs + fotos
├── 04-financial.ts      # Migra AR/AP + fechamentos
├── 05-inventory.ts      # Migra materiais + fornecedores + movimentações
├── 06-employees.ts      # Migra funcionários + comissões
├── reconcile.ts         # Valida totais: financeiro, estoque, contagens
├── rollback.ts          # Reverte migração por domínio
└── README.md            # Procedimento passo-a-passo
```

**Gate de migração:** Reconciliação automática após cada domínio. Se totais financeiros divergem, migração é revertida e bloqueada até correção.

### 2.8 Checklist de Handoff entre Agentes (por Fase)

Quando um agente IA termina uma fase e outro assume a próxima (ou o mesmo agente retoma após pausa), este checklist garante continuidade sem regressão.

**Ao INICIAR uma fase, o agente DEVE:**

- [ ] Ler este PRD (Partes 5 e 6 obrigatórias — regras e anti-patterns)
- [ ] Verificar CI verde na `main` (`pnpm build && pnpm test` passando)
- [ ] Ler os testes da fase anterior para entender o estado atual
- [ ] Confirmar que o banco está com migrations atualizadas (`pnpm db:push`)
- [ ] Verificar que a sidebar tem links para todos os módulos já implementados

**Ao CONCLUIR uma fase, o agente DEVE entregar:**

- [ ] Branch `feature/fase-XX-modulo-nome` com PR aberto
- [ ] CI verde no PR (lint + types + tests + build)
- [ ] Lista de arquivos criados/modificados no PR description
- [ ] Evidências de teste:
  - Screenshot ou log dos testes passando
  - Contagem de testes adicionados nesta fase
  - Confirmação de que testes de fases anteriores continuam passando (regressão zero)
- [ ] Checklist do Definition of Done (seção 2.3) preenchido no PR description
- [ ] Se a fase envolveu schema: migration gerada e testável
- [ ] Se a fase envolveu background job: job registrado e testável com `pnpm jobs:test`
- [ ] Nota de handoff: resumo de 3-5 linhas do que foi feito, decisões tomadas, e qualquer debt técnico aceito intencionalmente

**Template de nota de handoff (no PR description):**
```markdown
## Handoff — Fase XX: [Nome do Módulo]

### O que foi feito
- [Lista de entregáveis concluídos]

### Decisões tomadas
- [Ex: "Usei pg_trgm para busca fuzzy de clientes por ser mais performático que LIKE"]

### Debt técnico aceito (se houver)
- [Ex: "Paginação no frontend usa offset simples. Cursor-based pagination fica para otimização futura"]

### Próxima fase depende de
- [Ex: "Schema de clients e pricing estarem no banco — ambos criados nesta fase"]
```

### 2.9 Critérios de Observabilidade por Módulo

Observabilidade não é "coisa de DevOps no final". Cada módulo é instrumentado **durante sua implementação**, não depois.

**Checklist de observabilidade (adicionado ao Definition of Done):**

- [ ] **Logs estruturados:** Toda operação de escrita loga `{ action, tenantId, userId, entityId, timestamp }` via Pino.
- [ ] **Métricas de negócio:** Cada módulo expõe pelo menos 1 métrica de negócio relevante:

| Módulo | Métrica obrigatória | Tipo |
|--------|-------------------|------|
| Clientes | `clients.created.total` por tenant | Counter |
| Trabalhos | `jobs.active.count`, `jobs.overdue.count` | Gauge |
| Kanban | `kanban.move.duration_ms` (tempo entre colunas) | Histogram |
| Financeiro | `receivables.overdue.total_brl` por tenant | Gauge |
| Estoque | `inventory.below_minimum.count` | Gauge |
| Funcionários | `commissions.pending.total_brl` | Gauge |
| IA Flow | `ai.request.duration_ms`, `ai.request.error_rate` | Histogram/Counter |
| Auth | `auth.login.success`, `auth.login.failure` | Counter |
| Licenciamento | `license.limit.hit.count` por feature | Counter |

- [ ] **Alertas configurados:** Cada módulo define pelo menos 1 condição de alerta:

| Módulo | Alerta | Condição | Canal |
|--------|--------|----------|-------|
| Auth | Login brute force | > 10 falhas/min do mesmo IP | Sentry + log |
| Financeiro | AR vencida não notificada | AR com status `overdue` há > 48h sem notificação | Cron retry + log |
| Estoque | Estoque crítico ignorado | Material abaixo do mínimo há > 7 dias sem OC | Notificação in-app ao admin |
| IA | LLM degradada | Taxa de erro > 20% em janela de 5min | Sentry + fallback automático |
| Geral | Erro 5xx spike | > 5 erros 5xx em 1 minuto | Sentry |

- [ ] **Health check endpoint:** `/health` retorna status do banco e cron jobs. Usado pelo load balancer e pelo monitoring.

### 2.10 Referência: Tipos MySQL (Manus) → PostgreSQL

O proteticflow-ui usa Drizzle com driver MySQL (TiDB). A nova stack usa PostgreSQL. Os tipos e a sintaxe de schema são diferentes. Esta migração acontece na **Fase 1** (Infraestrutura), antes de qualquer módulo de negócio.

**Mapeamento de tipos:**

| MySQL (atual) | PostgreSQL (novo) | Nota |
|--------------|-------------------|------|
| `mysqlTable` | `pgTable` | Import diferente do Drizzle |
| `mysqlEnum` | `pgEnum` | Definido fora da tabela no Postgres |
| `int().autoincrement()` | `serial()` | Serial é auto-incremento nativo do PG |
| `DATETIME` / `timestamp` | `timestamp({ withTimezone: true })` | PG armazena UTC com timezone |
| `TINYINT(1)` | `boolean()` | PG tem tipo boolean nativo |
| `varchar(N)` | `varchar(N)` | Sem mudança |
| `decimal(M,N)` | `numeric(M,N)` | Sem mudança funcional |
| `text` | `text` | Sem mudança |

**Passos concretos:**

1. Criar `drizzle.config.ts` com `dialect: "postgresql"` e driver `pg`.
2. Reescrever `schema.ts`: trocar todos os imports e factories (`mysqlTable` → `pgTable`, `mysqlEnum` → `pgEnum`).
3. Gerar migrations limpas (`pnpm drizzle-kit generate`).
4. Testar `pnpm db:push` contra PostgreSQL local.
5. Atualizar connection string no `.env.example`.
6. Se houver dados a migrar do MySQL, usar `pgloader` (ferramenta dedicada MySQL→PG) com mapeamento de tipos.

**Risco:** Baixo. É trabalho mecânico de substituição de tipos. Drizzle tem documentação explícita para PostgreSQL.

---

## PARTE 3 — REQUISITOS FUNCIONAIS (289 requisitos em 27 módulos)

### Premissas

1. **Nenhum módulo é "concluído" sem:** Schema → Service → Router → Testes → Página → Link na sidebar.
2. **Todo dado de negócio é isolado por tenant.** Sem exceção.
3. **Toda operação de escrita respeita RBAC e licenciamento.** Sem exceção.
4. **Referência de dados:** Modelos Django (56 models, ~1561 campos) são a especificação funcional. A profundidade de campos do Django é o mínimo aceitável.
5. **Referência de UI:** Componentes `.tsx` do Manus são o padrão visual mínimo.

---

### MÓDULO 01 — Autenticação e Identidade

**Referência Django:** `accounts/models.py`, `accounts/views.py`  
**Referência Manus:** Manus OAuth (substituir por próprio)

| ID | Requisito | Detalhes |
|----|----------|---------|
| 01.01 | Registro com email + senha | Validação Zod. Senha: mín 8 chars, 1 maiúscula, 1 número. Hash bcrypt (12 rounds). |
| 01.02 | Login com JWT | Access token (15min, httpOnly cookie) + Refresh token (7d, httpOnly cookie). Sem localStorage. |
| 01.03 | Refresh automático | Interceptor no tRPC client que renova transparentemente. |
| 01.04 | Logout | Invalida refresh token (blacklist em Redis). |
| 01.05 | Recuperação de senha | Token de reset via email (expira em 1h). |
| 01.06 | 2FA (TOTP) | Setup com QR code. Verificação no login. Opcional por usuário. |
| 01.07 | Sessões ativas | Listar e revogar sessões (dispositivos). |
| 01.08 | Alteração de senha | Exige senha atual. |
| 01.09 | Perfil do usuário | Nome, email, telefone, avatar. |
| 01.10 | Exportação de dados (LGPD) | Endpoint que exporta todos os dados do usuário em JSON. |
| 01.11 | Permissions endpoint | GET que retorna array de módulos acessíveis pelo usuário logado (baseado no role). |
| 01.12 | Listagem de usuários (admin) | Lista todos os usuários do tenant com role, status, último login. |
| 01.13 | Criação de usuário (admin) | Admin cria usuário com role predefinido, envia email de ativação. |

---

### MÓDULO 02 — Multi-Tenancy

**Referência Django:** Não existe (era o gap principal)  
**Referência Manus:** `drizzle/schema.ts` (tabelas tenants + tenant_members)

| ID | Requisito | Detalhes |
|----|----------|---------|
| 02.01 | Criar tenant (laboratório) | Nome, CNPJ, telefone, email, endereço, cidade, UF. Gera slug único. Criador vira admin. |
| 02.02 | Onboarding pós-registro | Wizard: dados do lab → primeiro cliente → primeira OS. Redirect se não tem tenant. |
| 02.03 | Convites por email | Admin convida com role predefinido. Token com expiração (7d). |
| 02.04 | Aceitar convite | Página pública. Se já tem conta, associa. Se não, cria conta + associa. |
| 02.05 | Membros do tenant | Listar membros, alterar role, remover membro. |
| 02.06 | Múltiplos tenants por usuário | Um técnico pode trabalhar em mais de um lab. |
| 02.07 | Troca de tenant ativo | Dropdown no header. Troca contexto sem relogar. |
| 02.08 | Dados do tenant | Editar nome, CNPJ, contato, logo. |
| 02.09 | Desativação de tenant | Soft delete. Dados preservados por 90 dias. |
| 02.10 | Isolamento de dados | TODA query de negócio filtra por tenantId. Teste automatizado garante. |

---

### MÓDULO 03 — Gestão de Clientes

**Referência Django:** `apps/clients/models.py` (21 campos)  
**Referência Manus:** `Clientes.tsx` (41KB)

| ID | Requisito | Detalhes |
|----|----------|---------|
| 03.01 | Criar cliente | Nome, tipo documento (CPF/CNPJ), nº documento (único por tenant), pessoa de contato, email, telefone primário/secundário. |
| 03.02 | Endereço completo | Rua, número, complemento, bairro, cidade, UF, CEP. Busca automática por CEP (ViaCEP). |
| 03.03 | Preferências técnicas | Campo texto livre para observações técnicas do cliente. |
| 03.04 | Ajuste de preço por cliente | Percentual (-100% a +100%). Aplicado automaticamente ao criar OS. |
| 03.05 | Status ativo/inativo | Soft delete. Clientes inativos não aparecem em selects. |
| 03.06 | Listagem com busca | Busca por nome, documento, telefone. Filtro por status. Paginação. |
| 03.07 | Edição de cliente | Todos os campos editáveis. Histórico de alterações (audit log). |
| 03.08 | Exclusão de cliente | Apenas superadmin. Verificação de OS vinculadas. |
| 03.09 | Extrato do cliente | Resumo: total de OS, valor total, valores pendentes, histórico de pagamentos. |
| 03.10 | Blocos de OS recorrentes | Templates de OS frequentes por cliente para criação rápida. |

---

### MÓDULO 04 — Gestão de Trabalhos (OS)

**Referência Django:** `apps/jobs/models.py` (40 campos em 5 models: Job, JobItem, JobStage, JobLog, JobPhoto)  
**Referência Manus:** `Trabalhos.tsx` (23KB)

| ID | Requisito | Detalhes |
|----|----------|---------|
| 04.01 | Criar OS | Nº de ordem (auto-incremento por tenant), cliente (select), paciente, data entrada (auto), prazo, tipo de prótese, material, cor, instruções. |
| 04.02 | Itens da OS | Múltiplos serviços por OS. Cada item: serviço (da tabela de preços), quantidade, preço unitário **congelado no momento da criação** (ver AP-02), percentual de ajuste do cliente congelado, preço total calculado e armazenado. **O preço NUNCA é derivado em runtime da tabela atual.** |
| 04.03 | Status machine | Recebido → Em Produção → Controle de Qualidade → Concluído → Entregue. Também: Cancelado (de qualquer estado). |
| 04.04 | Etapas de produção | Configuráveis por tenant (JobStage com nome, ordem, descrição). Cada OS tem etapa atual. |
| 04.05 | Log de eventos | Toda mudança de status/etapa registrada com timestamp, usuário e detalhes. |
| 04.06 | Fotos da OS | Upload de múltiplas fotos por etapa. Descrição por foto. Armazenamento S3. |
| 04.07 | Atribuição de técnico | Vincular um ou mais funcionários à OS com tarefa específica. |
| 04.08 | Cálculo automático de total | Soma dos itens × quantidade × preço unitário, com ajuste do cliente. |
| 04.09 | Listagem com filtros | Por status, cliente, data de entrada, prazo, atrasados. Paginação. |
| 04.10 | Edição de OS | Todos os campos exceto nº de ordem. Auditado. |
| 04.11 | Exclusão | Apenas superadmin. Soft delete. |
| 04.12 | Dar baixa | Marcar como concluído. Data de conclusão automática. |
| 04.13 | Marcar como entregue | Data de entrega automática. Atualiza status financeiro. |
| 04.14 | Impressão de OS | Gera PDF da OS com dados do lab (logo, endereço). |

---

### MÓDULO 05 — Kanban de Produção

**Referência Django:** Não existe  
**Referência Manus:** `Kanban.tsx` (35KB), `routers/kanban.ts`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 05.01 | Quadro visual | Colunas por status: Aguardando, Em Produção, Revisão, Pronto, Entregue. |
| 05.02 | Drag-and-drop | Arrastar card entre colunas altera status. Transições inválidas bloqueadas. |
| 05.03 | Card da OS | Nº ordem, cliente, serviço, prazo, técnico responsável, indicador de urgência. |
| 05.04 | Filtros | Por cliente, técnico, atrasados. |
| 05.05 | Atribuição no card | Selecionar técnico responsável diretamente no card. |
| 05.06 | Histórico de movimentações | Timeline por OS mostrando todas as mudanças de coluna. |
| 05.07 | Métricas | Tempo médio por etapa, taxa de atraso, produtividade por técnico. |
| 05.08 | Indicadores visuais | Vermelho para atrasado, amarelo para prazo em 24h, verde para no prazo. |

---

### MÓDULO 06 — Tabelas de Preços

**Referência Django:** `apps/pricing/models.py` + `views.py` (com reajuste, export, import)  
**Referência Manus:** `TabelaPrecos.tsx`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 06.01 | CRUD de tabelas | Nome (único por tenant), descrição, flag "tabela padrão". |
| 06.02 | Itens de serviço | Nome, código interno, descrição, preço unitário, status ativo/inativo. Único por (tabela + nome). |
| 06.03 | Reajuste percentual em lote | Aplicar +X% ou -X% em todos os itens ativos de uma tabela. |
| 06.04 | Exportação CSV | Download da tabela com colunas: nome, código, descrição, preço. |
| 06.05 | Importação CSV | Upload CSV com upsert (cria ou atualiza por nome). Relatório de erros. |
| 06.06 | Página dedicada | Listagem de tabelas + drill-down para itens. Busca dentro dos itens. |
| 06.07 | Vinculação de tabela a cliente | Cada cliente pode ter uma tabela padrão associada. |
| 06.08 | Simulador de preço na criação de OS | Ao selecionar serviço, mostra preço da tabela do cliente com ajuste aplicado. |

---

### MÓDULO 07 — Sistema Financeiro

**Referência Django:** `apps/financial/models.py` (58 campos em 5 models)  
**Referência Manus:** `Financeiro.tsx` (37KB)

| ID | Requisito | Detalhes |
|----|----------|---------|
| 07.01 | Contas a Receber | Gerado automaticamente ao criar OS. Valor, valor ajustado (por cliente), vencimento, status (pendente/pago/vencido/cancelado). |
| 07.02 | Contas a Pagar | Vinculado a fornecedor. Descrição, valor, emissão, vencimento, pagamento, referência. |
| 07.03 | Fechamento mensal | Período, receita total, total de jobs, total de clientes, breakdown detalhado em JSON. |
| 07.04 | Fechamento automático | node-cron job no dia 1 de cada mês, 6h. Gera fechamento do mês anterior por tenant. |
| 07.05 | Lembretes de vencimento | node-cron job diário 8h. Email para clientes com contas vencidas. |
| 07.06 | Balanço anual | Dados trimestrais: receita, despesas, lucro, margem. |
| 07.07 | Relatório de pagadores | Ranking de clientes por valor e pontualidade. |
| 07.08 | Fluxo de caixa | Entradas vs saídas por período. Projeção baseada em vencimentos futuros. |
| 07.09 | Recibos | Gerar recibo PDF para pagamento recebido. |
| 07.10 | Livro caixa | Registro diário de entradas e saídas com saldo acumulado. |
| 07.11 | Extrato detalhado por OS | PDF com breakdown completo de uma OS: itens, valores, ajustes, pagamentos. |
| 07.12 | Listagem de AR com filtros | Por status (pendente/pago/vencido), por cliente, por período. Paginação. |
| 07.13 | Listagem de AP com filtros | Por status, por fornecedor, por período. |
| 07.14 | Marcar AR como pago | Registra data de pagamento. Atualiza status. |
| 07.15 | Marcar AP como pago | Registra data e método de pagamento. |
| 07.16 | Cancelar AR/AP | Com motivo obrigatório. Auditado. |
| 07.17 | Dashboard financeiro parcial | Cards com totais: a receber, a pagar, vencidos, fluxo do mês. Dentro da página financeira. |
| 07.18 | Fechamento por cliente | Gerar fechamento de um período para um cliente específico (PDF). |

> **Nota:** Boletos e NFS-e são funcionalidades fiscais complexas com módulo dedicado (ver **MÓDULO 22 — Integração Fiscal**).

---

### MÓDULO 08 — Roteiro de Entregas

**Referência Django:** `DeliverySchedule` model  
**Referência Manus:** Parcial (só dashboard)

| ID | Requisito | Detalhes |
|----|----------|---------|
| 08.01 | Página dedicada | Calendário semanal com OS agendadas para entrega por dia. |
| 08.02 | Criar roteiro do dia | Selecionar OS para entrega, definir motorista, veículo, rota. |
| 08.03 | Agrupamento por cliente | OS do mesmo cliente agrupadas para otimizar entrega. |
| 08.04 | Status por OS | Agendado → Em Trânsito → Entregue / Falhou. |
| 08.05 | Impressão de roteiro | PDF com lista ordenada: cliente, endereço, OS, telefone. |
| 08.06 | Indicadores visuais | Atrasado (vermelho), no prazo (verde), entregue (cinza). |
| 08.07 | Alertas de prazo | Push notification 24h antes do vencimento. |
| 08.08 | Otimização de rotas | Agrupamento inteligente por região/bairro. Sugestão de ordem de entrega para minimizar deslocamento. |
| 08.09 | Relatório de entregas | Histórico por período: entregas realizadas, falhas, tempo médio por rota. |

---

### MÓDULO 09 — Gestão de Estoque

**Referência Django:** `apps/materials/models.py` (48 campos em 6 models)  
**Referência Manus:** `Estoque.tsx` (49KB), `routers/stock.ts`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 09.01 | Materiais | Nome, código, barcode, descrição, categoria, unidade, estoque mínimo, estoque atual, custo médio, último preço de compra. |
| 09.02 | Categorias | Nome, descrição, cor (para UI). |
| 09.03 | Fornecedores | Nome, CNPJ, contato, email, telefone, endereço, notas, status ativo/inativo. |
| 09.04 | Movimentações | Tipo (entrada/saída/ajuste), material, quantidade, preço unitário, total, referência, notas. Vínculo opcional com fornecedor e OS. |
| 09.05 | Custo médio automático | Recalculado a cada entrada. Fórmula: (estoque_atual × custo_médio + quantidade_nova × preço_novo) / estoque_novo. |
| 09.06 | Alertas de reposição | Indicador visual quando estoque < mínimo. Notificação push. |
| 09.07 | Ordens de compra | Rascunho → Enviado → Recebido → Cancelado. Itens com material, quantidade, preço. |
| 09.08 | Recebimento automático | Ao marcar OC como "Recebido", cria movimentações de entrada para cada item. |
| 09.09 | Import XML de NF-e | Parser de XML de nota fiscal eletrônica para criar OC automaticamente. |
| 09.10 | Consumo por OS | Registrar saída de material vinculada a OS específica. |
| 09.11 | Listagem de materiais com filtros | Por categoria, por alerta (abaixo do mínimo), busca por nome/código/barcode. Paginação. |
| 09.12 | Listagem de fornecedores com filtros | Por status ativo/inativo, busca por nome/CNPJ. |
| 09.13 | Listagem de movimentações | Por material, por tipo (entrada/saída/ajuste), por período. |
| 09.14 | Listagem de ordens de compra | Por status, por fornecedor, por período. |
| 09.15 | Dashboard de estoque parcial | Cards com: total materiais, itens abaixo do mínimo, valor total em estoque, OCs pendentes. Dentro da página de estoque. |
| 09.16 | CRUD completo de fornecedores | Criar, editar, desativar fornecedor. |
| 09.17 | CRUD de categorias | Criar, editar, excluir categoria. |
| 09.18 | Cálculo automático de total da OC | Soma dos itens × quantidade × preço. Atualiza ao editar itens. |

---

### MÓDULO 10 — Gestão de Funcionários e RH

**Referência Django:** `apps/employees/models.py` (56 campos em 5 models)  
**Este é o módulo que o Manus subestimou. A profundidade do Django é o mínimo.**

| ID | Requisito | Detalhes |
|----|----------|---------|
| 10.01 | Dados pessoais | Nome, CPF, RG, data de nascimento, email, telefone. |
| 10.02 | Endereço completo | Rua, número, complemento, bairro, cidade, UF, CEP. |
| 10.03 | Vínculo empregatício | Data admissão, data demissão, cargo, departamento. |
| 10.04 | Tipo de funcionário | Técnico em Prótese, Auxiliar, Recepcionista, Gerente, Proprietário, Outro. |
| 10.05 | Tipo de contrato | CLT, PJ/MEI, Freelancer, Estagiário, Autônomo, Temporário. |
| 10.06 | Remuneração | Salário base, vale transporte, vale alimentação, plano de saúde. |
| 10.07 | Dados bancários | Banco, agência, conta. |
| 10.08 | Comissão padrão | Percentual (0-100%) do valor da OS. |
| 10.09 | Habilidades | Nome da habilidade, nível (1-4), descrição. |
| 10.10 | Atribuição de OS | Vincular funcionário + OS + tarefa + comissão (override ou padrão). |
| 10.11 | Cálculo de comissão | Automático no fechamento: valor da OS × percentual de comissão. |
| 10.12 | Pagamento de comissões | Período, total, método de pagamento, referência. Itens detalhados por atribuição. |
| 10.13 | Relatório de produção | Por funcionário: OS concluídas, valor gerado, comissões no período. |

---

### MÓDULO 11 — Folha de Pagamento

**Referência Django:** `payroll/models.py` (PayrollPeriod, PayrollEntry, FinancialReport)

| ID | Requisito | Detalhes |
|----|----------|---------|
| 11.01 | Períodos de folha | Ano, mês, data referência, status (aberto/fechado). |
| 11.02 | Entradas | Por funcionário: salário base, horas extras, valor HE, bônus, descontos, bruto, líquido. |
| 11.03 | Geração automática | Gera entradas para todos os funcionários ativos com dados consolidados (salário + comissões). |
| 11.04 | Fechamento de período | Bloqueia edição. Registra quem fechou e quando. |
| 11.05 | Totalizadores | Total bruto, total descontos, total líquido do período. |
| 11.06 | Holerite PDF | Documento individual por funcionário com dados do lab. |
| 11.07 | Integração com IA | "Gere a folha de março" via Flow. |

---

### MÓDULO 12 — Scans 3D

**Referência Django:** `apps/scans/models.py` + `xml_parser.py` + `tasks.py`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 12.01 | Upload de scan | Arquivos STL (superior/inferior), XML do scanner, imagem de galeria. |
| 12.02 | Scanners suportados | iTero, Medit, 3Shape, Carestream, Outro. |
| 12.03 | Parser de XML | Extrai automaticamente: ID do pedido, dentista, CRO, paciente, procedimento, data, prazo, endereço, observações. |
| 12.04 | Vínculo com OS e Cliente | FK opcional para Job e Client. |
| 12.05 | Status de impressão | Aguardando → Enviado → Imprimindo → Concluído → Erro. |
| 12.06 | Envio para impressora 3D | API REST para impressora (IP configurável em settings). |
| 12.07 | Metadados raw | JSON com dados completos do XML para referência. |

---

### MÓDULO 13 — Assistente IA "Flow"

**Referência Django:** `ai_assistant/command_processor.py` (18 comandos)  
**Referência Manus:** `FlowIA.tsx` (streaming)

| ID | Requisito | Detalhes |
|----|----------|---------|
| 13.01 | Chat com IA | Interface de chat com histórico de sessões. Streaming de resposta. |
| 13.02 | Contexto real do lab | IA tem acesso a: total de clientes, trabalhos por status, entregas do dia, estoque crítico, financeiro. |
| 13.03 | CMD: Relatório de contas a receber | (admin) "Gerar relatório de contas a receber" → dados reais formatados. |
| 13.04 | CMD: Fechamento mensal | (admin) "Fazer fechamento mensal" / "Fechamento do mês" → calcula e retorna. |
| 13.05 | CMD: Balanço anual | (admin) "Gerar balanço anual" → dados trimestrais. |
| 13.06 | CMD: Folha de pagamento | (admin) "Gerar folha de pagamento" → resumo da folha. |
| 13.07 | CMD: Trabalhos pendentes | (todos) "Mostrar trabalhos pendentes" → lista com cliente, prazo, status. |
| 13.08 | CMD: Entregas de hoje | (todos) "Listar entregas para hoje" → OS programadas para entrega. |
| 13.09 | CMD: Cadastrar cliente | (todos) "Cadastrar novo cliente" → orientações e link para formulário. |
| 13.10 | CMD: Cadastrar trabalho | (todos) "Cadastrar novo trabalho" → orientações e link. |
| 13.11 | CMD: Finalizar trabalho | (todos) "Dar baixa em trabalho" → orientações para conclusão. |
| 13.12 | CMD: Listar clientes | (todos) "Listar clientes" → lista com totais. |
| 13.13 | CMD: Buscar cliente | (todos) "Buscar cliente João" → busca por nome/telefone. |
| 13.14 | CMD: Prever receita | (admin) "Preveja receita dos próximos 3 meses" → predição com score de confiança. |
| 13.15 | CMD: Estimar tempo de produção | (todos) "Quanto tempo para fazer uma prótese total?" → estimativa ML. |
| 13.16 | CMD: Resumo analytics | (admin) "Resumo analítico do mês" → KPIs consolidados. |
| 13.17 | CMD: Smart orders | (admin) "Dashboard de pedidos inteligentes" → sugestões de OS. |
| 13.18 | CMD: Agendar | (todos) "Agendar prova para quinta com Dr. Silva" → cria evento na agenda. |
| 13.19 | Quick actions | Atalhos visuais no chat (botões de ação rápida). |
| 13.20 | Respeito a RBAC | Comandos filtrados por role. Colaborador não acessa comandos financeiros. |
| 13.21 | Fallback graceful | Se LLM falha, retorna mensagem amigável. Não quebra UX. |
| 13.22 | Aprendizado contextual | IA melhora respostas baseada no histórico de interações do usuário e padrões do laboratório. |
| 13.23 | Sugestões proativas | IA sugere ações sem ser perguntada: "Você tem 3 trabalhos atrasados. Deseja ver?" ao abrir o dashboard. |

---

### MÓDULO 14 — Portal do Cliente

**Referência Django:** Não existe  
**Referência Manus:** `Portal.tsx` (22KB), `routers/portal.ts`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 14.01 | Acesso via token | URL pública `/portal/:token`. Sem login necessário. Token UUID v4 com expiração. |
| 14.02 | Gestão de tokens | Admin gera, lista, revoga tokens. Associado a cliente. |
| 14.03 | Visualização de OS | Lista de OS do cliente com status, prazo, progresso visual. |
| 14.04 | Timeline de movimentações | Histórico de cada OS com datas e status. |
| 14.05 | Envio de link por email | Botão que envia email ao cliente com link do portal. |
| 14.06 | Fotos públicas | Fotos da OS marcadas como "visível no portal". |
| 14.07 | Design profissional | Layout limpo com logo do lab. Sem sidebar. Foco no conteúdo. |

---

### MÓDULO 15 — Relatórios e PDFs

**Referência Django:** `apps/financial/views_reports.py`  
**Referência Manus:** `RelatoriosPDF.tsx` (26KB), `pdf.engine.ts`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 15.01 | Fechamento mensal PDF | Com logo do lab, dados do período, breakdown por cliente. |
| 15.02 | Trabalhos por período | Lista de OS com filtros de data. |
| 15.03 | Relatório de produtividade | Por técnico: OS concluídas, tempo médio, taxa de atraso. |
| 15.04 | Relatório trimestral/anual | Consolidado com gráficos. |
| 15.05 | Relatório de estoque | Posição atual, movimentações do período, alertas. |
| 15.06 | Envio por email | Qualquer relatório pode ser enviado ao destinatário como anexo PDF. |
| 15.07 | Export CSV | Dados tabulares exportáveis para planilha. |
| 15.08 | Relatório de entregas | Entregas realizadas, falhas, tempo médio por rota, por período. |
| 15.09 | Relatório de compras | Ordens de compra por período, por fornecedor, totais. |
| 15.10 | Relatório fiscal | NFS-e emitidas, boletos gerados/pagos, por período. |

---

### MÓDULO 16 — Notificações

**Referência Django:** Parcial (Celery tasks)  
**Referência Manus:** `push.ts`, `db.push.ts`, `pushNotifications.test.ts`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 16.01 | In-app | Sino no header com badge de contagem. Lista de notificações com tipo (info, warning, error). |
| 16.02 | Push (PWA) | VAPID keys. Service Worker. Funciona com app fechada. |
| 16.03 | Email | Transacional: convites, lembretes de vencimento, relatórios, reset de senha. |
| 16.04 | Alerta de prazo 24h | Automático, hourly check. Push + in-app. |
| 16.05 | Preferências | Cada usuário configura quais notificações receber por canal. |

---

### MÓDULO 17 — Licenciamento e Billing

**Referência Django:** `apps/licensing/models.py` (LicensePlan, License, LicenseCheck)  
**Gap:** Nenhuma versão tem billing funcional

| ID | Requisito | Detalhes |
|----|----------|---------|
| 17.01 | 4 planos definidos | Trial, Starter, Pro, Enterprise (ver seção 1.5). |
| 17.02 | Enforcement de limites | Middleware que bloqueia create quando limite atingido. Retorna erro tipado. |
| 17.03 | Banner de aviso | Aparece quando uso > 80% do limite. |
| 17.04 | Modal de upgrade | Comparativo de planos com CTA. |
| 17.05 | Página de planos | Pública para visitantes, contextual para logados. |
| 17.06 | Stripe integration | Checkout session, webhook handler, portal de cobrança. |
| 17.07 | Sincronização automática | Webhook atualiza plano do tenant em tempo real. |
| 17.08 | Expiração de trial | Job diário verifica e notifica. Bloqueia após expiração. |
| 17.09 | Badge de plano | Indicador do plano atual no sidebar. |
| 17.10 | Atualização automática de contadores | Após cada create de client/job/priceTable, atualiza contadores do tenant. |
| 17.11 | Verificação de licença (health check) | Endpoint que retorna status da licença: válida, expirada, limites. Log de verificações. |
| 17.12 | Tracking de uso de features | Registra quantas vezes cada feature é usada por tenant (analytics de produto). |
| 17.13 | Página admin de gestão de tenants | (Superadmin global) Listar todos os tenants, ver plano, uso, status. Apenas para o operador do SaaS. |

---

### MÓDULO 18 — Configurações do Laboratório

**Referência Django:** `LabSettings` model  
**Referência Manus:** `ConfigLab.tsx`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 18.01 | Dados do lab | Nome, endereço, telefone, email, website. |
| 18.02 | Logo | Upload de imagem. Usada em PDFs e portal. |
| 18.03 | Cores de branding | Primária e secundária (hex). Aplicadas no portal do cliente. |
| 18.04 | Textos de relatório | Header e footer customizáveis para PDFs. |
| 18.05 | Configuração de impressora 3D | IP e porta da API. |
| 18.06 | Configuração SMTP | Para envio de emails do lab (opcional — fallback para Resend). |
| 18.07 | Página de configurações | Tabs: Perfil, Laboratório, Funcionários, Autorizações, Planos. |

---

### MÓDULO 19 — Dashboard

**Implementado por último — depende de todos os outros módulos.**

| ID | Requisito | Detalhes |
|----|----------|---------|
| 19.01 | KPIs financeiros | Total a receber, total a pagar, vencidos, fluxo de caixa. |
| 19.02 | KPIs de trabalhos | Ativos, concluídos, pendentes, atrasados. |
| 19.03 | KPIs de clientes | Total, ativos, novos este mês. |
| 19.04 | KPIs de estoque | Total de itens, itens com estoque baixo, valor total. |
| 19.05 | KPIs de funcionários | Total, comissões do período, atribuições pendentes. |
| 19.06 | Trabalhos recentes | Lista dos últimos 5-10 trabalhos com status. |
| 19.07 | Entregas do dia | Lista de OS para entrega hoje. |
| 19.08 | Gráficos | Receita mensal (barras), distribuição de serviços (pizza), tendência (linha). |
| 19.09 | Sparklines por KPI | Mini-gráfico de tendência em cada card. |
| 19.10 | Refresh manual + auto | Botão de atualizar + polling a cada 5min. |

---

### MÓDULO 20 — IA Avançada (Diferencial Competitivo)

**Referência Django:** `intelligent_scheduling/`, `predictive_analytics/`, `smart_orders/`, `automated_support/`  
**Referência Manus:** `db.predictions.ts`, `FlowIA.tsx`  
**Referência Docs:** `analise_potencial_ia_dentalflow.md`, `implementacao_agendamento_inteligente.md`

| ID | Requisito | Detalhes |
|----|----------|---------|
| 20.01 | Predição de receita | Séries temporais baseadas em histórico. Mensal, trimestral, anual. Score de confiança. |
| 20.02 | Estimativa de tempo de produção | Baseado em tipo de prótese, material, complexidade, histórico do técnico. |
| 20.03 | Alertas preditivos | "Estoque de zircônia vai acabar em 15 dias". "Receita de abril tende a cair 12%". |
| 20.04 | Sugestão de OS (Smart Orders) | LLM analisa histórico do cliente e sugere próxima OS provável. |
| 20.05 | Otimização de agenda | LLM analisa carga do kanban e sugere redistribuição. |
| 20.06 | Detecção de padrões de retrabalho | Identifica tipos de trabalho com maior taxa de refação. |
| 20.07 | Sugestão de materiais | Baseado em OS similares anteriores. |
| 20.08 | Sequenciamento de produção | Organiza ordem de trabalhos para máxima eficiência (agrupamento de cerâmicas para forno, etc.). |
| 20.09 | Análise de crédito de clientes | Avalia risco de inadimplência baseado em histórico de pagamentos. |
| 20.10 | Cobrança inteligente | Estratégias de cobrança personalizadas por perfil do cliente (frequência, canal, tom). |
| 20.11 | Precificação dinâmica | Sugere ajustes de preço baseados em demanda, custos e concorrência. |
| 20.12 | Sugestões proativas de compra | "Baseado no consumo médio, você deve pedir zircônia na próxima semana." |

---

### MÓDULO 21 — Auditoria e Segurança

| ID | Requisito | Detalhes |
|----|----------|---------|
| 21.01 | Audit log | Toda operação de escrita registrada: quem, quando, o quê, valor anterior, valor novo. |
| 21.02 | Rate limiting | Por tenant e por usuário. Configurável. |
| 21.03 | Validação de input | Zod em toda entrada. Sanitização contra XSS. |
| 21.04 | Headers de segurança | HSTS, CSP, X-Frame-Options, X-Content-Type-Options. |
| 21.05 | CORS restritivo | Apenas domínios autorizados em produção. |
| 21.06 | Proteção IDOR | Todo acesso verifica tenantId + permissão. |
| 21.07 | Logging estruturado | Pino com correlation ID por request. |
| 21.08 | Restrições de acesso programáticas | Admin pode bloquear acesso de um usuário/feature temporariamente com motivo. |
| 21.09 | Sumário de uso por tenant | Dashboard admin mostrando uso de cada feature por tenant no período. |

---

### MÓDULO 27 — Infraestrutura e DevOps

**Referência Django:** Dockerfile, docker-compose, Nginx, scripts, Prometheus  
**Estas são funcionalidades que precisam ser construídas e testadas como qualquer módulo.**

| ID | Requisito | Detalhes |
|----|----------|---------|
| 27.01 | Dockerfile de produção | Multi-stage build Node.js. Imagem otimizada (< 200MB). |
| 27.02 | Dockerfile de staging | Com hot-reload e debug habilitado. |
| 27.03 | docker-compose dev | PostgreSQL 16 + MinIO (S3 local) + App. Redis **não** incluído no lançamento. |
| 27.04 | docker-compose prod | Node.js + PostgreSQL + Redis + Nginx. SSL via Let's Encrypt. |
| 27.05 | Nginx config | Reverse proxy, rate limiting, cache de assets, SSL termination. |
| 27.06 | CI pipeline (GitHub Actions) | Lint (eslint) → Type check (tsc) → Test (vitest) → Build → Docker image. Em todo PR. |
| 27.07 | CD pipeline | Deploy automático para staging em push na `dev`. Deploy para prod em tag de release. |
| 27.08 | Scripts de backup | Backup diário do PostgreSQL para S3. Retenção de 30 dias. Script de restore. |
| 27.09 | Scripts de deploy | Script que executa migrations, seed se necessário, reinicia serviços. |
| 27.10 | Jobs assíncronos | node-cron para lançamento. Documentar path de migração para BullMQ + Redis quando volume justificar. |
| 27.11 | Settings por ambiente | Validação de env vars com Zod no boot. Fail-fast se variável obrigatória falta. `.env.example` completo. |
| 27.12 | Monitoramento | Prometheus metrics endpoint. Health check endpoint (`/health`). |
| 27.13 | Sentry integration | Captura de erros com contexto (userId, tenantId, route). Source maps no upload de build. |
| 27.14 | Seed de dados | Script que popula banco com dados de demonstração para testes e demo. Idempotente. |
| 27.15 | Testes E2E (Playwright) | Fluxos críticos: registro → onboarding → criar cliente → criar OS → kanban → financeiro → PDF. |

---

### MÓDULO 22 — Integração Fiscal (Boletos + NFS-e)

**Referência Django:** Não existe  
**Referência LabFácil:** BoletoFácil, E-notaFácil, NFS-E (funcionalidades de destaque nos planos pagos)  
**Prioridade:** Alta — sem isso o lab não opera formalizado

| ID | Requisito | Detalhes |
|----|----------|---------|
| 22.01 | Geração de boletos | Integração com API bancária (Inter, Sicoob, ou gateway como Asaas/PagHiper). Registro, emissão PDF, código de barras, Pix copia-e-cola. |
| 22.02 | Boleto vinculado a Conta a Receber | Ao criar AR, opção de gerar boleto automaticamente com vencimento da AR. |
| 22.03 | Baixa automática de boleto | Webhook do gateway identifica pagamento e marca AR como paga. |
| 22.04 | Gestão de boletos | Listagem com status (aberto, pago, vencido, cancelado). Filtros por período e cliente. |
| 22.05 | Remessa e retorno | Suporte a arquivos de remessa/retorno CNAB 240/400 para bancos que exigem. |
| 22.06 | Emissão de NFS-e | Integração com prefeitura via API (Focus NFe, eNotas, ou NFe.io). Dados: tomador, serviço, ISSQN, valor. |
| 22.07 | NFS-e vinculada a OS/Fechamento | Emitir NFS-e para uma OS específica ou para um fechamento mensal do cliente. |
| 22.08 | NFS-e em lote | Emitir múltiplas notas de uma vez (fechamento mensal → 1 NFS-e por cliente). |
| 22.09 | Consulta e cancelamento | Consultar status da NFS-e na prefeitura. Cancelar dentro do prazo legal. |
| 22.10 | PDF da NFS-e | Download do DANFSE gerado pela prefeitura. |
| 22.11 | Relatório fiscal | Notas emitidas por período, total de ISSQN, exportação para contador. |
| 22.12 | Configuração fiscal | CNPJ do lab, inscrição municipal, código de serviço (CNAE), alíquota ISSQN, regime tributário. Configurável por tenant em Settings. |

> **Nota técnica:** A complexidade deste módulo depende da integração externa. Recomendo usar um gateway intermediário (Asaas para boletos, Focus NFe para notas) ao invés de integrar direto com bancos/prefeituras. Isso reduz de ~30 integrações para 2 APIs.

---

### MÓDULO 23 — Sistema de Agenda

**Referência Django:** Não existe como módulo (apenas mencionado no roadmap)  
**Referência LabFácil:** Funcionalidade de Agenda  
**Referência Docs:** `analise_comparativa_labfacil.md`, `documentacao_dentalflow.md` seção 9.1

| ID | Requisito | Detalhes |
|----|----------|---------|
| 23.01 | Calendário visual | Visualização semanal e mensal de compromissos e prazos. |
| 23.02 | Tipos de evento | Prova de trabalho, entrega, retirada, reunião, manutenção de equipamento, outros. |
| 23.03 | Vínculo com OS | Evento pode ser vinculado a uma OS (prova, entrega). Atualiza status automaticamente. |
| 23.04 | Vínculo com cliente | Evento vinculado ao cliente. Exibe no portal do cliente se configurado. |
| 23.05 | Atribuição de responsável | Cada evento tem um funcionário responsável. |
| 23.06 | Lembretes | Notificação push/email X horas antes do evento. Configurável. |
| 23.07 | Recorrência | Eventos recorrentes (ex: manutenção de equipamento mensal). |
| 23.08 | Drag-and-drop no calendário | Reagendar arrastando o evento para outra data/hora. |
| 23.09 | Vista por funcionário | Filtrar agenda por técnico/recepcionista para ver carga de trabalho. |
| 23.10 | Integração com IA | "Flow, agende uma prova para o trabalho #123 com o Dr. Silva na quinta" → cria evento automaticamente. |

---

### MÓDULO 24 — Suporte Automatizado ao Dentista

**Referência Django:** `automated_support/models.py` (559 linhas, 6 models: ChatbotConversation, ChatbotMessage, AutomatedNotification, AutoResponseTemplate, SmartScheduling, SupportTicket)  
**Referência Manus:** Parcial (chatbot via FlowIA)  
**Referência Docs:** `analise_potencial_ia_dentalflow.md` seção 3

| ID | Requisito | Detalhes |
|----|----------|---------|
| 24.01 | Chatbot para dentistas | Chat acessível via portal do cliente. IA responde dúvidas sobre status de OS, prazos, procedimentos. |
| 24.02 | Tipos de conversa | Consulta de status, agendamento, orçamento, suporte técnico, informações gerais, reclamação. |
| 24.03 | Detecção de intenção | IA classifica o que o dentista quer (intent) e extrai entidades (nº da OS, nome do paciente). |
| 24.04 | Templates de resposta | Respostas padronizadas por categoria, editáveis pelo admin do lab. |
| 24.05 | Escalação para humano | Se IA não consegue resolver ou se satisfação < 3, escala para atendente humano com contexto. |
| 24.06 | Score de satisfação | Ao final da conversa, dentista avalia (1-5). Métricas de atendimento no dashboard. |
| 24.07 | Tickets de suporte | Quando chatbot escala, cria ticket com prioridade (baixa/média/alta/urgente). Fluxo: aberto → em atendimento → resolvido → fechado. |
| 24.08 | Notificações automáticas | Agendamento de notificações por canal (email/push/SMS): lembrete de prazo, trabalho pronto, promoções. |
| 24.09 | Personalização de notificação | Merge fields: nome do cliente, nº OS, prazo, valor. |
| 24.10 | WhatsApp Business API | Integração para envio de notificações e atendimento via WhatsApp. Canal preferido de dentistas brasileiros. |

> **Nota:** WhatsApp Business API (24.10) é um diferencial enorme no mercado brasileiro. Dentistas preferem WhatsApp a email. A integração pode ser via API oficial (cara) ou via provedores como Twilio/MessageBird (mais acessível). Pode ser implementado como fase posterior sem bloquear o lançamento.

---

### MÓDULO 25 — Simulador de Preços

**Referência Django:** Não existe  
**Referência LabFácil:** Funcionalidade "Simulador"

| ID | Requisito | Detalhes |
|----|----------|---------|
| 25.01 | Simulação de orçamento | Selecionar serviços da tabela de preços, definir quantidade, aplicar ajuste de cliente, ver total estimado. |
| 25.02 | Comparativo entre tabelas | Mostrar preço do mesmo serviço em diferentes tabelas lado a lado. |
| 25.03 | Simulação "e se" | "Se eu der 15% de desconto para este cliente, qual o impacto na margem?" |
| 25.04 | Enviar orçamento ao dentista | Gerar PDF do orçamento com logo do lab e enviar por email/WhatsApp. |
| 25.05 | Converter em OS | Botão "Aprovar e criar OS" que transforma o orçamento simulado em OS real. |
| 25.06 | Histórico de simulações | Salvar simulações para consulta futura. Status: rascunho, enviado, aprovado, rejeitado. |

---

### MÓDULO 26 — Multi-Empresa / Filiais

**Referência Django:** Não existe  
**Referência LabFácil:** Funcionalidade "Multi-Empresa" e "Filial"

| ID | Requisito | Detalhes |
|----|----------|---------|
| 26.01 | Filiais como sub-tenants | Um tenant "matriz" pode criar filiais que compartilham tabelas de preço e clientes mas têm estoque e funcionários independentes. |
| 26.02 | Dashboard consolidado | Matriz visualiza KPIs agregados de todas as filiais. |
| 26.03 | Relatórios por filial | Filtrar qualquer relatório por filial específica ou consolidado. |
| 26.04 | Transferência entre filiais | Mover OS ou materiais entre filiais. |
| 26.05 | Controle de acesso por filial | Funcionário pode ter acesso a uma ou mais filiais. |

> **Nota:** Este módulo é exclusivo do plano Enterprise. Arquitetura: filiais são tenants normais com uma FK `parentTenantId` que aponta para a matriz.

---

