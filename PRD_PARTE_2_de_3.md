## PARTE 4 — PLANO DE EXECUÇÃO

### Cadência Real

Sem sprints formais. Sem comitês. Sem release trains. A cadência é:

- **Unidade de trabalho:** sessão (um bloco contínuo de desenvolvimento com um agente IA, tipicamente 2-6 horas).
- **Ciclo:** módulo completo (banco ao botão). Não se inicia o próximo módulo até o atual passar por todos os quality gates.
- **Validação:** após cada módulo, o coordenador humano testa manualmente os fluxos + confirma CI verde.
- **Branching:** `main` é sempre deployável. Cada módulo é desenvolvido em `feature/modulo-XX` e mergeado via PR com CI verde.

### Paralelização

Com 4 agentes IA, fases podem ser paralelizadas quando não têm dependência entre si:

- **Fase 8 (Financeiro) e Fase 10 (Estoque)** podem rodar em paralelo (ambos dependem só de Tenant, não um do outro).
- **Fase 11 (Funcionários) e Fase 9 (Entregas)** podem rodar em paralelo.
- **Fase 13 (Scans) e Fase 14 (Agenda)** podem rodar em paralelo.
- **Fase 24 (Boletos) e Fase 25 (NFS-e)** podem rodar em paralelo.

Paralelização efetiva pode comprimir 20-30% do tempo sequencial.

### Fases Detalhadas

---

#### BLOCO A — FUNDAÇÃO (Fases 1-3)

**Fase 1 — Infraestrutura (Módulo 27)**  
**Sessões:** 2 | **Dependência:** nenhuma

| Entregável | Detalhe |
|-----------|---------|
| Monorepo Turborepo | `apps/web`, `apps/server`, `packages/shared` |
| Docker Compose dev | PostgreSQL 16 + Redis 7 + MinIO |
| CI GitHub Actions | Lint → Type check → Test → Build. Bloqueia PR se falhar. |
| `.env.example` | Todas as variáveis documentadas. `.gitignore` com `.env*`, `dist/`, `node_modules/`, `*.pid`, `*.log`. |
| Schema base Drizzle | Conexão PostgreSQL, `drizzle.config.ts`, schema migrado de MySQL→PG (ver seção 2.9), primeiro `pnpm db:push`. |
| Packages shared | Estrutura de types, constants, validation, utils. |

**Gate de saída:** `pnpm build` verde. `pnpm test` verde (mesmo sem testes ainda). Docker compose sobe e conecta ao banco.

---

**Fase 2 — Auth (Módulo 01: 01.01-01.13)**  
**Sessões:** 2-3 | **Dependência:** Fase 1

| Entregável | Detalhe |
|-----------|---------|
| Schema: users | Com todos os campos do requisito 01.01-01.13. |
| Auth service | Registro, login (bcrypt + JWT httpOnly), refresh, logout (blacklist Redis), reset de senha. |
| 2FA | otplib + qrcode. Setup e verificação. |
| Frontend | Páginas: login, registro, forgot-password, setup-2fa. |
| RBAC base | 5 roles definidos em `packages/shared/constants/roles.ts`. Middleware `protectedProcedure`, `adminProcedure`. |

**Gate de saída:** Registro → Login → Refresh → Logout funcional. 2FA setup e verify. Rota protegida retorna 401 sem token. CI verde.

---

**Fase 3 — Multi-Tenancy (Módulo 02: 02.01-02.10)**  
**Sessões:** 2-3 | **Dependência:** Fase 2

| Entregável | Detalhe |
|-----------|---------|
| Schema: tenants, tenant_members | Com indexes e constraints. **Inclui `parentTenantId` nullable (FK self-reference) desde o dia 1** — mesmo que Módulo 26 (Multi-Empresa) seja implementado só pós-lançamento. Adicionar FK depois com dados reais é migração dolorosa. Adicionar agora como nullable custa zero. |
| Context factory | Resolve `tenantId` do usuário em toda request autenticada. Rejeita se não tem tenant. |
| Tenant service | Criar, listar, trocar, convidar, aceitar convite, membros. |
| `licensedProcedure` (stub) | Middleware que TODA procedure de create usa desde o dia 1. Na Fase 3 é um passthrough (permite tudo). Na Fase 23, ganha lógica real de enforcement. **Isso garante que nenhum create é adicionado nas Fases 4-22 sem passar pelo middleware — quando o enforcement chegar, ele já cobre tudo automaticamente.** |
| Onboarding wizard | Página pós-registro: dados do lab → primeiro fluxo. |
| Tenant switcher | Dropdown no header para troca de tenant. |
| **TESTE CRÍTICO: tenant isolation** | Script que varre TODAS as queries de negócio e verifica filtro por `tenantId`. Roda no CI. Falha se qualquer query não filtrar. |

**Gate de saída:** 2 tenants criados. Dados do tenant A invisíveis para usuário do tenant B. Teste de isolation verde. CI verde.

---

#### BLOCO B — CORE CRUD (Fases 4-7)

**Fase 4 — Clientes (Módulo 03: 03.01-03.10)**  
**Sessões:** 2 | **Dependência:** Fase 3

**Gate de saída:** CRUD completo. Busca por nome/CPF. Ajuste de preço por cliente. Extrato. Filtrado por tenant. Testes passando.

**Fase 5 — Tabelas de Preços (Módulo 06: 06.01-06.08)**  
**Sessões:** 1-2 | **Dependência:** Fase 3

**Gate de saída:** CRUD tabelas + itens. Reajuste em lote. Import/export CSV. Página dedicada (não PlansPage). Filtrado por tenant.

**Fase 6 — Trabalhos/OS (Módulo 04: 04.01-04.14)**  
**Sessões:** 3-4 | **Dependência:** Fase 4 + 5

**Gate de saída:** Criar OS com itens da tabela de preços. Status machine completa. Fotos por etapa. Log de eventos. Cálculo automático de total com ajuste do cliente. PDF de OS. Filtrado por tenant.

**Fase 7 — Kanban (Módulo 05: 05.01-05.08)**  
**Sessões:** 2 | **Dependência:** Fase 6

**Gate de saída:** Drag-and-drop funcional. Transições válidas. Atribuição de técnico. Indicadores visuais de prazo. Métricas.

**Gate de bloco B:** E2E completo: criar cliente → criar OS → mover no kanban → concluir → ver log. CI verde.

---

#### BLOCO C — OPERAÇÕES (Fases 8-14)

**Fase 8 — Financeiro (Módulo 07: 07.01-07.18)**  
**Sessões:** 3-4 | **Dependência:** Fase 6

**Gate de saída:** AR gerado automaticamente ao criar OS. AP vinculado a fornecedor. Fechamento mensal. Livro caixa. Reconciliação financeira validada (soma dos ARs = receita do fechamento).

**Fase 9 — Roteiro de Entregas (Módulo 08: 08.01-08.09)**  
**Sessões:** 1-2 | **Dependência:** Fase 6

**Fase 10 — Estoque (Módulo 09: 09.01-09.18)**  
**Sessões:** 3-4 | **Dependência:** Fase 3

**Gate de saída:** Materiais, fornecedores, categorias, movimentações. Custo médio automático. Alertas de reposição. Ordens de compra com recebimento automático. Import XML NF-e.

**Fase 11 — Funcionários (Módulo 10: 10.01-10.13)**  
**Sessões:** 3-4 | **Dependência:** Fase 6

**Gate de saída:** 35+ campos (profundidade Django). 6 tipos de contrato. Comissões com override. Atribuição de OS. Relatório de produção. Cálculo automático.

**Fase 12 — Comissões + Folha (Módulos 10.10-10.13 + 11)**  
**Sessões:** 2-3 | **Dependência:** Fase 11 + 8

**Gate de saída:** Geração de folha consolida salário + comissões. Fechamento de período. Holerite PDF.

**Fase 13 — Scans 3D (Módulo 12: 12.01-12.07)**  
**Sessões:** 2 | **Dependência:** Fase 6

**Fase 14 — Agenda (Módulo 23: 23.01-23.10)**  
**Sessões:** 2-3 | **Dependência:** Fase 6 + 4 + 11

**Gate de bloco C:** Reconciliação financeira. Folha auditável. Estoque com movimentações rastreáveis. CI verde.

---

#### BLOCO D — PLATAFORMA (Fases 15-19)

**Fase 15 — Configurações (Módulo 18: 18.01-18.07)**  
**Sessões:** 1-2 | **Dependência:** Fase 3

**Fase 16 — Notificações (Módulo 16: 16.01-16.05)**  
**Sessões:** 2 | **Dependência:** Fase 3

**Gate de saída:** In-app + Push (VAPID + Service Worker) + Email (templates). Preferências por usuário.

**Fase 17 — Portal do Cliente (Módulo 14: 14.01-14.07)**  
**Sessões:** 2 | **Dependência:** Fase 6 + 4

**Gate de saída:** Acesso via token sem login. Dados de OS sem exposição de dados financeiros sensíveis. Link enviável por email.

**Fase 18 — Simulador de Preços (Módulo 25: 25.01-25.06)**  
**Sessões:** 1-2 | **Dependência:** Fase 5 + 4

**Fase 19 — Relatórios + PDF (Módulo 15: 15.01-15.10)**  
**Sessões:** 2-3 | **Dependência:** Fase 8 + 6 + 10

**Gate de saída:** 10 tipos de relatório. PDF server-side com logo do lab. Envio por email. Export CSV.

**Gate de bloco D:** Portal público sem vazamento de dados. Relatórios homologados com todos os módulos de dados.

---

#### BLOCO E — INTELIGÊNCIA (Fases 20-22)

**Fase 20 — IA Flow (Módulo 13: 13.01-13.23)**  
**Sessões:** 3-4 | **Dependência:** Todos os módulos de dados (B, C, D)

**Gate de saída:** 16 comandos funcionais (13.03-13.18). Streaming. Contexto real do lab. RBAC respeitado. Fallback graceful se LLM falha.

**Fase 21 — Suporte Automatizado (Módulo 24: 24.01-24.10)**  
**Sessões:** 2-3 | **Dependência:** Fase 17 + 20

**Gate de saída:** Chatbot no portal. Detecção de intenção. Templates editáveis. Escalação para humano. Tickets.

**Fase 22 — IA Avançada (Módulo 20: 20.01-20.12)**  
**Sessões:** 3-4 | **Dependência:** Fase 20 + dados históricos

**Gate de saída:** Predição de receita. Smart orders. Avaliação de qualidade de respostas com benchmark.

---

#### BLOCO F — COMERCIALIZAÇÃO (Fases 23-25)

**Fase 23 — Licenciamento + Stripe (Módulo 17: 17.01-17.13)**  
**Sessões:** 3-4 | **Dependência:** Fase 3

**Gate de saída:** 4 planos configurados. Limites enforcados. Stripe checkout + webhook. Banner de aviso. Trial expiration.

**Fase 24 — Integração Fiscal: Boletos (Módulo 22: 22.01-22.05)**  
**Sessões:** 3-4 | **Dependência:** Fase 8

**Gate de saída:** Boleto gerado. Baixa automática via webhook. Listagem com filtros. Mock contratual para CI; integração real com gateway homologado.

**Fase 25 — Integração Fiscal: NFS-e (Módulo 22: 22.06-22.12)**  
**Sessões:** 3-4 | **Dependência:** Fase 8 + 15

**Gate de saída:** NFS-e emitida. Emissão em lote. Consulta/cancelamento. PDF do DANFSE. Configuração fiscal por tenant.

**Gate de bloco F:** Fechamento financeiro-fiscal consistente ponta a ponta: OS → AR → Boleto → Pagamento → NFS-e → Fechamento.

---

#### BLOCO G — FINALIZAÇÃO (Fases 26-28)

**Fase 26 — Dashboard (Módulo 19: 19.01-19.10)**  
**Sessões:** 2-3 | **Dependência:** TODOS os módulos

**Gate de saída:** KPIs alimentados por dados reais de todos os módulos. Gráficos. Sparklines. Refresh auto.

**Fase 27 — Auditoria + Segurança + Infra Avançada (Módulos 21 + 27)**  
**Sessões:** 2-3 | **Dependência:** TODOS os módulos

**Gate de saída:** Audit trail. Rate limiting. Headers de segurança. CORS restritivo. Nginx. Backup/restore com prova de execução. Dockerfile de produção otimizado. Zero vulnerabilidade crítica (npm audit + gitleaks).

**Fase 28 — Polimento + Landing + E2E**  
**Sessões:** 3-4 | **Dependência:** Tudo

| Entregável | Detalhe |
|-----------|---------|
| Landing page | Hero, features, planos, depoimentos, CTA de cadastro. |
| Onboarding guiado completo | Wizard: dados do lab → primeiro cliente → primeira OS. |
| Testes E2E Playwright | Registro → Onboarding → CRUD → Kanban → Financeiro → PDF → Portal. |
| Performance | Lazy loading. Queries N+1 eliminadas. Lighthouse ≥ 90 performance. |
| SEO landing | Meta tags, Open Graph, sitemap. |
| Seed de demonstração | Dados realistas para demo e testes. Idempotente. |
| Runbook de operação | Como fazer deploy, backup, restore, scale. Sem assumir conhecimento prévio. |

**Gate de go-live:** E2E completo verde. Performance dentro dos SLOs. Zero vulnerabilidade crítica. Runbook revisado.

---

#### BLOCO H — EXPANSÃO PÓS-LANÇAMENTO

| Fase | Módulo | Sessões |
|------|--------|---------|
| 29 | WhatsApp Business API (24.10) | 2-3 |
| 30 | Multi-Empresa / Filiais (26) | 3-4 |

---

### Totalização

| Bloco | Sessões (sequencial) | Com paralelização (~25%) | Acumulado |
|-------|---------------------|-------------------------|-----------|
| A — Fundação | 6-8 | 6-8 | 6-8 |
| B — Core CRUD | 8-10 | 6-8 | 12-16 |
| C — Operações | 17-22 | 13-17 | 25-33 |
| D — Plataforma | 8-11 | 6-9 | 31-42 |
| E — Inteligência | 8-11 | 8-11 | 39-53 |
| F — Comercialização | 9-12 | 7-10 | 46-63 |
| G — Finalização | 7-10 | 7-10 | 53-73 |
| **Produto comercializável (A-G)** | **63-84** | **53-73** | |
| H — Expansão pós-lançamento | 5-7 | 5-7 | 58-80 |

> **O produto é lançado no final do Bloco G, completo.** Blocos A-G são o produto inteiro. Bloco H (WhatsApp e Multi-Empresa) são expansões que ampliam o mercado endereçável mas não são necessárias para o lançamento.

---

## PARTE 5 — REGRAS INVIOLÁVEIS

### Código
1. **Cada módulo é implementado do banco ao botão.** Schema → Service → Router → Testes → Página → Sidebar link.
2. **Todo dado de negócio filtra por tenantId.** Teste automatizado no CI verifica. Sem exceção.
3. **Todo input validado com Zod.** Schema compartilhado entre front e back via `packages/shared`.
4. **Todo create/update/delete respeita RBAC.** Middleware explícito por procedure.
5. **Todo create respeita limites do plano.** `licensedProcedure` (stub desde Fase 3, enforcement real na Fase 23).
6. **Zero JavaScript puro.** Tudo TypeScript strict. Zero `any`.
7. **Contracts-first.** Toda procedure tRPC tem input e output tipados. Zod valida na fronteira.

### Repositório
8. **Zero `.env` no repositório.** Apenas `.env.example`. Secrets via variáveis de ambiente do provedor.
9. **Zero build artifacts no Git.** `dist/`, `node_modules/`, `*.pid`, `*.log`, `*.sqlite` no `.gitignore`.
10. **Zero arquivo de debug/teste na raiz.** Sem `fake_output.txt`, `tunnel_log.txt`, `test_image.jpg`, `ollama_agent_poc.py`.
11. **Main é sempre deployável.** Feature branches com PR. CI verde obrigatório para merge.

### Referências
12. **Django para profundidade de campos.** 56 models, 1561 campos. Se o Django tem 35 campos em Employee, o novo sistema tem pelo menos 35.
13. **Manus para qualidade de UI.** Animações, transições, estados loading/empty/error. Sem páginas "cruas".
14. **Integrações via gateway.** Boletos via Asaas/PagHiper. NFS-e via Focus NFe/eNotas. LLM via API direta. Sem intermediários.

### Produto
15. **Bloco H não bloqueia lançamento.** WhatsApp e Filiais são expansões de mercado, não funcionalidades core.
16. **PRD congelado.** Qualquer adição de funcionalidade vira issue para próximo ciclo. Sem scope creep.
17. **Paridade funcional verificável.** Cada módulo novo é validado contra a lista de 289 requisitos deste documento antes de ser marcado como concluído.

---

## PARTE 6 — ANTI-PATTERNS PROIBIDOS + PADRÕES MANDATÓRIOS

> **LEIA ESTA SEÇÃO ANTES DE IMPLEMENTAR QUALQUER MÓDULO.**
> Esta seção existe porque os mesmos erros foram cometidos 3 vezes no histórico deste projeto (Django v1, Django v2, Manus). Cada anti-pattern abaixo causou um bug real. Cada padrão mandatório é a correção permanente.

### AP-01: Query sem filtro de tenant
```
❌ PROIBIDO
db.select().from(clients).where(eq(clients.status, 'active'))

✅ OBRIGATÓRIO
db.select().from(clients).where(and(eq(clients.tenantId, tenantId), eq(clients.status, 'active')))
```
**Histórico:** O proteticflow-ui tinha 37 colunas `tenantId` no schema mas ZERO filtros nas queries reais (`db.ts`, `db.stock.ts`, `db.reports.ts` — todos zero). Dados de todos os labs visíveis para todos.
**Teste:** CI roda script que verifica todas as queries. Se encontrar select/insert/update/delete em tabela com `tenantId` sem filtro, falha.

### AP-02: Preço não congelado na OS (price snapshot)
```
❌ PROIBIDO — referenciar preço diretamente da tabela
job_items: { serviceItemId, quantity }  // preço calculado em runtime da tabela atual

✅ OBRIGATÓRIO — snapshot do preço no momento da criação
job_items: { serviceItemId, quantity, unitPriceAtOrder, adjustmentPercentage, totalPrice }
```
**Histórico:** Se a tabela de preços é reajustada em +10%, as OS antigas NÃO devem ter seus valores alterados. O preço deve ser fotografado no momento da criação da OS.
**Schema obrigatório para `job_items`:**
- `unitPriceAtOrder` — preço unitário no momento da criação (copiado da tabela)
- `adjustmentPercentage` — ajuste do cliente no momento da criação
- `totalPrice` — calculado e armazenado (não derivado em runtime)

### AP-03: Frontend esperando dados que o backend não retorna
```
❌ PROIBIDO
// Frontend
const { financialSummary, jobsSummary, inventorySummary } = await trpc.dashboard.getSummary.query()
// Backend retorna apenas { totalJobs, totalClients }
// → Tudo renderiza zerado ou crasheia

✅ OBRIGATÓRIO
// O tipo de retorno do router É o contrato. tRPC garante type safety.
// Se o frontend espera 8 campos, o router DEVE retornar 8 campos.
// TypeScript vai dar erro de compilação se houver mismatch.
```
**Histórico:** O `DashboardPage.jsx` da branch dev esperava 8 grupos de dados. O `dashboard/views.py` retornava 4 campos. O dashboard renderizava tudo zerado.
**Prevenção:** tRPC + TypeScript elimina esse bug por design — o compilador pega o mismatch.

### AP-04: Página existente mas inacessível via navegação
```
❌ PROIBIDO
// Página existe em /pages/FinancialClosingPage.jsx
// Rota existe em App.jsx
// MAS nenhum link na Sidebar aponta para ela
// → Funcionalidade "fantasma" que ninguém encontra

✅ OBRIGATÓRIO
// Definition of Done inclui "Link na sidebar com ícone"
// Se não tem link na sidebar, não está concluído.
```
**Histórico:** A branch dev tinha 16 páginas mas a Sidebar só linkava para 7. Metade das funcionalidades existia mas era inacessível.

### AP-05: Rota de preços apontando para página errada
```
❌ PROIBIDO
// /pricing aponta para PlansPage (planos de licença)
// O usuário clica em "Tabelas de Preços" e vê planos Freemium

✅ OBRIGATÓRIO
// Cada rota tem uma página dedicada para sua funcionalidade
// /pricing → PricingPage (tabelas de preços de serviços)
// /plans → PlansPage (planos de licença do SaaS)
```
**Histórico:** Na branch dev, "Tabelas de Preços" na Sidebar levava a `/pricing` que renderizava `PlansPage` (planos de assinatura). Confusão total.

### AP-06: Middleware referenciado mas não implementado
```
❌ PROIBIDO
// Definition of Done diz "usar licensedProcedure"
// Mas licensedProcedure não existe até a Fase 23
// → 20 fases de desenvolvimento sem enforcement

✅ OBRIGATÓRIO
// licensedProcedure criado como stub (passthrough) na Fase 3
// Todo create o usa desde o dia 1
// Enforcement real ativado na Fase 23
// Quando ativar, TODOS os creates já passam por ele
```
**Histórico:** Identificado nesta auditoria. Corrigido no plano (Fase 3 agora inclui stub).

### AP-07: Schema sem campos para funcionalidade futura planejada
```
❌ PROIBIDO
// Módulo 26 (Multi-Empresa) precisa de parentTenantId na tabela tenants
// Mas esse campo não existe no schema inicial
// → Migração dolorosa com dados reais meses depois

✅ OBRIGATÓRIO
// Se uma funcionalidade futura PLANEJADA precisa de um campo no schema,
// adicionar como nullable no schema inicial. Custa zero. Evita migração.
// Campos: parentTenantId (tenants), priceTableId (clients)
```
**Histórico:** A análise comparativa com LabFácil identificou Multi-Empresa como feature de expansão. O schema do Manus não previa. Corrigido neste PRD.

### AP-08: Credenciais e artefatos no repositório
```
❌ PROIBIDO
.env.production (com SECRET_KEY, DATABASE_URL, API keys)
tunnel_log.txt (3.25MB de log)
fake_output.txt, django_pid.txt, requirements.txt.FullName
dist/ (build artifacts), test_image.jpg

✅ OBRIGATÓRIO
.gitignore com: .env*, dist/, node_modules/, *.pid, *.log, *.sqlite
Apenas .env.example no repo (com valores placeholder)
gitleaks rodando no CI
```
**Histórico:** A branch dev tinha `.env.production` commitado com SECRET_KEY e credenciais reais. A branch Manus tinha `tunnel_log.txt` de 3.25MB e URL hardcoded de Cloudflare tunnel no `settings.py`.

### AP-09: Dois frontends/backends no mesmo repositório
```
❌ PROIBIDO
/frontend/labmanager-frontend/ (React JSX)
/proteticflow-ui/ (React TypeScript + tRPC server)
/labmanager_source/ (Django)
// → 3 stacks, nenhum completo, nenhuma coerência

✅ OBRIGATÓRIO
// Um frontend. Um backend. Um banco. Uma linguagem.
// Monorepo com /apps/web e /apps/server, ambos TypeScript.
```
**Histórico:** A branch `proteticflow_Manus` tinha 3 projetos distintos: Django legado, frontend TypeScript, e ai-agent em Python. O merge das branches teria adicionado 936 arquivos sem resolver nenhum problema.

### AP-10: Multi-tenancy cosmético (colunas sem queries)
```
❌ PROIBIDO
// Schema tem tenantId em 37 tabelas
// Nenhuma query filtra por tenantId
// → Multi-tenancy existe no papel, não na prática

✅ OBRIGATÓRIO
// Se a coluna tenantId existe na tabela, TODA query nessa tabela DEVE filtrar por tenantId
// Teste automatizado verifica isso
// Service functions recebem tenantId como PRIMEIRO parâmetro (não opcional)
function listClients(tenantId: number, filters?: Filters) // tenantId obrigatório
```
**Histórico:** Descoberta mais grave da auditoria. O proteticflow-ui tinha `tenantId` em 37 posições do schema Drizzle mas db.ts (0 filtros), db.stock.ts (0), db.reports.ts (0), db.portal.ts (0), routers.ts (0).

### AP-11: CollaboratorManagementPage perdida
```
❌ PROIBIDO
// Funcionalidade existia em versão anterior (ZIPs v1.1.0 e v1.2.1)
// Desapareceu em ambas as branches sem substituto
// → Feature silenciosamente removida

✅ OBRIGATÓRIO
// Toda remoção de funcionalidade é intencional e documentada
// Se uma feature existia antes e não existe agora, é um bug até prova em contrário
// PRD com 289 requisitos é a checklist — se está no PRD, tem que existir
```
**Histórico:** `CollaboratorManagementPage.jsx` existia nos ZIPs mas não aparece em nenhuma branch do GitHub. Claude Code confirmou a ausência.

### AP-12: Dependências duplicadas ou hardcoded
```
❌ PROIBIDO
// requirements.txt com langchain-core listado duas vezes com mesma versão
// settings.py com URL de Cloudflare tunnel hardcoded em CSRF_TRUSTED_ORIGINS
// package.json com versões inexistentes (notistack 2.0.11)

✅ OBRIGATÓRIO
// Todas as URLs configuráveis via variáveis de ambiente
// npm audit e pip audit no CI
// Lockfile (package-lock.json / pnpm-lock.yaml) commitado e validado
```
**Histórico:** A branch Manus tinha `langchain-core` duplicado no requirements.txt e URL de tunnel em settings.py. A branch dev (changelog v1.1.0) tinha `notistack` com versão inexistente.

### AP-13: Race condition em operações numéricas (estoque/financeiro)
```
❌ PROIBIDO — read-compute-write separados
const item = await db.select().from(stock).where(eq(stock.id, id));
await db.update(stock).set({ qty: item.qty - requested });
// Dois requests simultâneos leem o mesmo valor → estoque fica negativo

✅ OBRIGATÓRIO — UPDATE atômico com verificação
await db.update(stock)
  .set({ qty: sql`${stock.qty} - ${requested}` })
  .where(and(eq(stock.id, id), gte(stock.qty, requested)));
// Se estoque insuficiente, WHERE falha → rows affected = 0 → erro tratado
```
**Histórico:** Identificado na análise de regressão (28 bugs). Padrão read-compute-write é a causa #1 de bugs de concorrência em sistemas de estoque.
**Padrão completo:** Ver seção 2.6, PAD-01.

### AP-14: Operação financeira multi-tabela fora de transação
```
❌ PROIBIDO — sem transação
await db.update(accountsReceivable).set({ status: 'paid' });
await db.insert(cashbookEntries).values({ type: 'credit', amount });
// Se o insert falha, AR fica como 'paid' mas sem entrada no caixa → inconsistência

✅ OBRIGATÓRIO — db.transaction()
await db.transaction(async (tx) => {
  await tx.update(accountsReceivable).set({ status: 'paid' });
  await tx.insert(cashbookEntries).values({ type: 'credit', amount });
});
// Se qualquer operação falha, tudo é revertido
```
**Histórico:** Identificado na análise de regressão. Qualquer operação que toca 2+ tabelas com dependência entre si deve ser transacional.
**Padrão completo:** Ver seção 2.6, PAD-02.

---

## APÊNDICE A — Itens recuperados de gap vs LabFácil

Checklist de funcionalidades do LabFácil mapeadas para módulos do PRD:

| Funcionalidade LabFácil | Módulo ProteticFlow | ID |
|------------------------|--------------------|----|
| Agenda | 23 — Sistema de Agenda | 23.01-23.10 |
| Pedidos | 04 — Trabalhos/OS | 04.01-04.14 |
| Extrato do Pedido | 07 — Financeiro | 07.11 |
| RoteiroBoy | 08 — Roteiro de Entregas | 08.01-08.09 |
| Boletos / BoletoFácil | 22 — Integração Fiscal | 22.01-22.05 |
| E-notaFácil / NFS-E | 22 — Integração Fiscal | 22.06-22.12 |
| Recibos | 07 — Financeiro | 07.09 |
| Contas a Pagar | 07 — Financeiro | 07.02 |
| Livro Caixa | 07 — Financeiro | 07.10 |
| Compras | 09 — Estoque | 09.07-09.09 |
| Estoque | 09 — Estoque | 09.01-09.10 |
| Fornecedores | 09 — Estoque | 09.03 |
| Funcionários | 10 — Funcionários | 10.01-10.13 |
| Folha de Pagamento | 11 — Folha de Pagamento | 11.01-11.07 |
| Lista de Preços | 06 — Tabelas de Preços | 06.01-06.06 |
| Extrato dos Clientes | 03 — Clientes | 03.09 |
| Contas a Receber | 07 — Financeiro | 07.01 |
| Simulador | 25 — Simulador de Preços | 25.01-25.06 |
| Multi-Empresa / Filial | 26 — Multi-Empresa | 26.01-26.05 |

**Funcionalidades onde ProteticFlow supera o LabFácil (sem equivalente no concorrente):**
- Kanban de produção com drag-and-drop (Módulo 05)
- Portal do cliente com token público (Módulo 14)
- Assistente IA "Flow" com comandos em linguagem natural (Módulo 13)
- Push Notifications PWA (Módulo 16)
- Analytics preditivo e smart orders (Módulo 20)
- Scans 3D com envio para impressora (Módulo 12)
- Suporte automatizado com chatbot IA (Módulo 24)
- Geração de PDF server-side com logo do lab (Módulo 15)

---

## APÊNDICE B — Bugs de Regressão do Legado (referência)

28 bugs foram identificados e confirmados por testes automatizados nas branches legadas (dev + proteticflow_Manus). Os 5 mais críticos foram transformados nos anti-patterns AP-01, AP-02, AP-13 e AP-14 deste documento. Os demais servem como referência para evitar reincidência:

**Categorias dos 28 bugs:**

| Categoria | Quantidade | Convertido em AP |
|-----------|-----------|-----------------|
| Race conditions (estoque, IDs sequenciais) | 5 | AP-13, AP-14, PAD-01, PAD-04 |
| Falta de RBAC em rotas sensíveis | 4 | AP-06, PAD-07 |
| Multi-tenancy cosmético (query sem filtro) | 3 | AP-01, AP-10 |
| Frontend desconectado do backend | 3 | AP-03, AP-04, AP-05 |
| Validação numérica ausente (valores negativos) | 3 | PAD-05 |
| Operações financeiras sem transação | 3 | AP-14, PAD-02 |
| Soft delete inconsistente | 2 | PAD-03 |
| Credenciais/artefatos no repo | 3 | AP-08 |
| Funcionalidade perdida entre versões | 2 | AP-11 |

> **Regra:** Antes de marcar qualquer módulo como concluído, verificar se os anti-patterns AP-01 a AP-14 e os padrões PAD-01 a PAD-08 foram respeitados. A Parte 6 e a seção 2.6 são leitura obrigatória.
