# ProteticFlow v3 — Documento Técnico Definitivo
## PRD Parte 3 de 3: Fases 29–39, Go-Live e Inventário Atualizado

**Versão:** 3.4  
**Data:** 07 de Abril de 2026  
**Supersede:** Este documento COMPLEMENTA PRD_PARTE_1_de_2 e PRD_PARTE_2_de_2 (v3.3). Fases 1-28 continuam válidas conforme documentado. Fases 29+ são definidas exclusivamente aqui.  
**Contexto:** Após a conclusão do roadmap original de 28 fases, 11 fases adicionais foram executadas para elevar o produto ao padrão de mercado: design system profissional, IA nativa com voz, semântica operacional de OS, integração atômica de compras, relatórios fiscais e pipeline de comandos estruturados.

---

## PARTE 7 — BLOCO H: EVOLUÇÃO PÓS-ROADMAP (Fases 29–38)

### Fase 29 — Design System e UX Branding

**Sessões:** 2 | **Dependência:** Fase 28 | **Migration:** nenhuma

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 29.01 | Design tokens CSS | CSS variables shadcn/ui: `--primary` = sky-500 (light) / sky-400 (dark). Paleta completa light+dark com slate, zinc, destructive, warning, success. |
| 29.02 | Tipografia | Geist (headings) + Inter (body). Carregamento via Google Fonts com preload. |
| 29.03 | Sidebar colapsável | Sidebar com toggle collapse/expand. Persiste preferência. Ícones Lucide. Agrupamento por seção (Produção, Financeiro, RH, etc). RBAC: itens filtrados por role. |
| 29.04 | Theme provider | Componente `ThemeProvider` com toggle light/dark. Persistência em localStorage. Respeita `prefers-color-scheme`. |
| 29.05 | Login premium | Layout dark permanente com particle field magnético (canvas, 120 partículas, repulsão do mouse, retorno elástico). Branding centralizado. |
| 29.06 | Formatação BRL | Função `formatBRL` centralizada em `lib/format.ts`. Usada em todo o frontend para valores monetários. |
| 29.07 | Responsividade | Layout mobile-first. Sidebar drawer em telas < 768px. Header compacto. |

**Decisão trancada:** Accent color = sky-500/sky-400 permanentemente. Zero violeta, indigo ou purple em qualquer componente. Qualquer PR que introduza essas cores é automaticamente reprovado.

---

### Fase 30 — OS Inteligente (Blocos e Auto-Resolve)

**Sessões:** 2 | **Dependência:** Fase 6 | **Migration:** 0019_os_blocks.sql

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 30.01 | Blocos de OS | Tabela `os_blocks`: reserva de faixa de numeração por cliente (`start_number`, `end_number`). Unique index por tenant + range. |
| 30.02 | Auto-resolve de cliente | Ao selecionar cliente na criação de OS, pré-preenche dados (tabela de preços, ajuste, contato). |
| 30.03 | Agenda sync | Criação de OS gera evento automático na agenda quando prazo definido. |
| 30.04 | Roteiro automático | OS com status "Concluído" aparece automaticamente como candidata no roteiro de entregas do dia. |

---

### Fase 31 — RH Expandido (Ponto Digital, Desempenho, Import)

**Sessões:** 2 | **Dependência:** Fase 11 | **Migration:** 0020_timesheets.sql

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 31.01 | Ponto digital | Tabela `timesheets`: `employee_id`, `date`, `clock_in`, `clock_out`, `hours_worked`, `notes`. FK para employees com tenant isolation. |
| 31.02 | Registro de ponto | Interface para registrar entrada/saída. Cálculo automático de horas trabalhadas. |
| 31.03 | Avaliação de desempenho | Métricas por funcionário: OS concluídas, comissões, tempo médio, taxa de atraso. |
| 31.04 | Import CSV de funcionários | Upload de CSV com parser que cria/atualiza registros de funcionários em lote. Relatório de erros. |
| 31.05 | Comissão por mês ou trabalho | Configuração de regime de comissão: por OS individual ou consolidado mensal. |

---

### Fase 32 — IA Nativa (NLP, Chat Rico, Dashboard Preditivo, TV Mode, 3D)

**Sessões:** 4 | **Dependência:** Fase 20 | **Migration:** nenhuma (usa tabelas de F20)

Esta é a fase que transforma a IA de feature auxiliar em diferencial competitivo nuclear.

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 32.01 | Criação de OS por linguagem natural | Usuário digita "Crie uma OS para Dr. Silva, coroa de zircônia, prazo sexta" → IA extrai entidades (cliente, serviço, prazo) e cria via `jobService.createJob`. |
| 32.02 | Resolvers de entidade | `resolveClientByName` (busca fuzzy + desambiguação), `resolveServiceItems` (mapeia nome de serviço → item da tabela de preços), `parseNaturalDate` (converte "sexta", "segunda", datas ISO). |
| 32.03 | Chat com Tiptap | Editor rich text (Tiptap) no input do chat IA. Suporta formatação básica, menções, e envio com Enter. |
| 32.04 | Dashboard preditivo | Seção "Análises Preditivas IA" no dashboard com 3 cards: previsão de atraso, estoque crítico futuro, previsão de receita. Dados reais via `ai.listPredictions` (corrigido na F39-R1). |
| 32.05 | Prediction Card | Componente reutilizável com título, previsão textual, barra de confiança (0-100%), tipo visual (positive/warning/info). |
| 32.06 | Kanban TV Mode | Rota `/kanban-tv`: visualização fullscreen do Kanban para monitor de produção. Auto-refresh. Sem sidebar. Foco em cards grandes e legíveis à distância. |
| 32.07 | Viewer 3D de STL | Componente `stl-viewer.tsx` com Three.js (r128). Renderiza arquivos STL de scans 3D diretamente no browser. Rotação orbital, zoom, iluminação. |
| 32.08 | Particle field (login) | Canvas com 120 partículas magnéticas. Mouse repele partículas com força inversamente proporcional à distância. Retorno elástico suave. Background permanentemente dark. |

**Dependência de API:** Anthropic Claude API (primário). Chamada direta sem intermediário. Model: `claude-sonnet-4-20250514`. Streaming via mutations tRPC (httpBatchLink não suporta subscriptions).

---

### Fase 33 — Cosmética Final (Purga de Cores e Types)

**Sessões:** 2 | **Dependência:** Fase 32 | **Migration:** nenhuma

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 33.01 | Purga violet/indigo | 103 arquivos editados. Zero ocorrências de `violet`, `indigo`, ou `neutral-[0-9]` em qualquer `.tsx` ou `.css`. Todas as referências substituídas por tokens semânticos (`--primary`, `--muted`, `--border`, etc). |
| 33.02 | Zero `any` | Varredura completa. Todos os `any` eliminados com tipos explícitos. |
| 33.03 | Zero `@ts-ignore` | Nenhuma supressão de tipo no codebase. |

**Resultado auditado:** `grep -rn 'violet\|indigo' apps/web/src/` → 0. `grep -rn ': any\|as any' apps/ packages/shared/src/` → 0.

---

### Fase 34 — Semântica de OS (Prova, Remoldagem, Suspenso, Urgente)

**Sessões:** 1 | **Dependência:** Fase 6 | **Migration:** 0021_job_subtypes.sql

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 34.01 | Subtipos de OS | Enum `job_sub_type`: `standard`, `proof`, `rework`. Campo obrigatório com default `standard`. |
| 34.02 | OS de prova | Subtipo `proof` com campos `proof_due_date` e `proof_returned_at`. Workflow: lab envia prova → dentista aprova/reprova → lab finaliza ou retrabalha. |
| 34.03 | OS de remoldagem | Subtipo `rework` com `rework_reason` (obrigatório) e `rework_parent_id` (FK para OS original). Rastreabilidade de retrabalho. |
| 34.04 | Suspensão de OS | Campos `suspended_at`, `suspended_by`, `suspend_reason`. OS pode ser suspensa de qualquer status e retomar para o status anterior. |
| 34.05 | Urgência | Flag `is_urgent` (boolean). Indicador visual no Kanban (borda vermelha, badge). Filtro dedicado. |
| 34.06 | Status de conclusão com retrabalho | Novo valor no enum `job_status`: `completed_with_rework`. Distingue OS concluídas limpas de OS que passaram por remoldagem. |
| 34.07 | Indexes | `jobs_subtype_idx`, `jobs_urgent_idx`, `jobs_suspended_at_idx`, `jobs_rework_parent_idx`. |
| 34.08 | E2E | `job-subtypes.spec.ts`: fluxo de criação de OS standard, proof e rework com env guard. |

---

### Fase 35 — Compras → Estoque → Contas a Pagar (Integração Atômica)

**Sessões:** 1 | **Dependência:** Fase 10 + Fase 8 | **Migrations:** 0022_purchases_ap_link.sql, 0023_purchases_received_by.sql

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 35.01 | Módulo de Compras (`purchases/`) | CRUD completo de ordens de compra. Status: rascunho → enviado → recebido → cancelado. Itens com material, quantidade, preço unitário. |
| 35.02 | Recebimento atômico | Ao confirmar recebimento de OC: (a) cria movimentações de entrada no estoque para cada item (UPDATE atômico, AP-13), (b) gera lançamento em Contas a Pagar vinculado à OC. Tudo em `db.transaction()` (AP-14). |
| 35.03 | Vínculo AP ↔ OC | Campos `reference_id` e `reference_type` em `accounts_payable`. Index `ap_reference_idx`. Permite rastrear qual AP veio de qual compra. |
| 35.04 | `received_by` | Campo em `purchase_orders` para registrar quem confirmou o recebimento. |
| 35.05 | Páginas frontend | `/compras` (listagem), `/compras/novo` (criação), `/compras/[id]` (detalhe + recebimento). |
| 35.06 | E2E | `purchase-flow.spec.ts`: fluxo criar → confirmar → verificar estoque + AP. |

---

### Fase 36 — Curva ABC (Produção + Financeiro)

**Sessões:** 1 | **Dependência:** Fase 8 + Fase 6 | **Migration:** nenhuma

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 36.01 | Classificação ABC | Algoritmo de Pareto 80/20: A (0-80% do valor acumulado), B (80-95%), C (95-100%). |
| 36.02 | 4 perspectivas | Curva ABC por: (a) cliente × receita, (b) serviço × volume, (c) material × consumo, (d) fornecedor × gasto. |
| 36.03 | Backend | `abc-curve.service.ts` com funções para cada perspectiva. Validadores Zod. Router com `tenantProcedure`. |
| 36.04 | Frontend | Integrado na página de relatórios (`/relatorios`). Seleção de perspectiva + período. Tabela com classificação + percentual acumulado. |

---

### Fase 37 — Relatórios Fiscais

**Sessões:** 2 | **Dependência:** Fase 8 + Fase 25 | **Migration:** nenhuma

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 37.01 | Relatório de faturamento | Por período: total faturado, por cliente, por serviço. |
| 37.02 | Relatório de despesas | Por período: total de AP, por fornecedor, por categoria. |
| 37.03 | DRE simplificado | Demonstrativo de Resultado: receita bruta – despesas = resultado líquido. Trimestral e anual. |
| 37.04 | Export CSV com BOM | Exportação CSV com BOM UTF-8 para compatibilidade com Excel brasileiro (acentos e R$). |
| 37.05 | Export PDF real | Geração server-side via jsPDF + autoTable. Com logo do lab (via `labSettings`), header/footer customizáveis. |
| 37.06 | Backend | `fiscal.service.ts`, `fiscal.router.ts`, `fiscal.validators.ts`. `pdf-generator.ts` dedicado para relatórios fiscais. |
| 37.07 | E2E | `fiscal-reports.spec.ts`: geração de relatório + download. |

---

### Fase 38 — Flow IA: Pipeline de Comandos, Voz e Ações Críticas

**Sessões:** 4 (3 sub-entregas) | **Dependência:** Fase 32 | **Migration:** 0024_ai_command_runs.sql

A maior fase pós-roadmap. Dividida em 3 entregas orbitais (O1, O2, O3).

#### F38-O1 — Pipeline de Comandos Estruturados

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 38.01 | Command registry | Registro declarativo de comandos com intent, entities esperadas, risk level, tool name. Sem `eval` ou `Function()`. |
| 38.02 | Command parser | `command-parser.ts`: extração de entidades tipadas a partir do input do usuário. Entity resolvers com desambiguação (`resolved` / `ambiguous` / `not_found`). |
| 38.03 | Risk engine | `risk.ts`: classificação automática de risco por comando: `read_only`, `assistive`, `transactional`, `critical`. Comandos `critical` exigem confirmação explícita. |
| 38.04 | Tool executor | `tool-executor.ts`: executa a tool associada ao comando. Tools NÃO acessam DB diretamente — chamam service functions existentes. |
| 38.05 | Tabela `ai_command_runs` | Auditoria completa: `tenant_id`, `user_id`, `channel`, `raw_input`, `intent`, `confidence`, `entities_json`, `risk_level`, `requires_confirmation`, `execution_status`, `tool_input_json`, `tool_output_json`, `error_code`. |
| 38.06 | Enums tipados | `ai_command_channel` (text/voice), `ai_command_risk_level` (4 níveis), `ai_command_execution_status` (6 estados). |
| 38.07 | Entity resolvers | `resolveClientsByName`, `resolveSuppliersByName`: busca fuzzy com tenant isolation + `isNull(deletedAt)` + limite 5 + retorno tipado (resolved/ambiguous/not_found). |

#### F38-O2 — Voz Segura (Push-to-Talk)

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 38.08 | Push-to-talk | Botão no chat IA que grava áudio enquanto pressionado. Sem gravação contínua. |
| 38.09 | STT via Whisper | Áudio enviado para Whisper API (OpenAI) para transcrição. |
| 38.10 | Preview de transcrição | Texto transcrito exibido ao usuário ANTES de enviar como comando. Usuário pode editar ou cancelar. |
| 38.11 | Áudio efêmero | Áudio NÃO é salvo em storage. Processado em memória e descartado após transcrição. Nenhum `writeFile`, `putObject` ou `upload` em `voice.service.ts`. |
| 38.12 | Hook `use-voice-recorder` | React hook para captura de áudio via MediaRecorder API. |
| 38.13 | E2E | `flow-voice.spec.ts`: fluxo de push-to-talk com env guard. |

#### F38-O3 — Ações Críticas com Confirmação Multi-Step

| ID | Entregável | Detalhes |
|----|-----------|---------|
| 38.14 | Financial tools | `financial-tools.ts`: tools que chamam `financialService` para marcar AR como pago, gerar fechamento, etc. Risco: `transactional` ou `critical`. |
| 38.15 | Payroll tools | `payroll-tools.ts`: gerar folha, fechar período. Risco: `critical` (requer confirmação). |
| 38.16 | Purchase tools | `purchase-tools.ts`: criar OC, confirmar recebimento (com integração atômica F35). Risco: `transactional`. |
| 38.17 | Multi-step confirmation | Comandos `critical` geram step `awaiting_confirmation` no `ai_command_runs`. Usuário deve confirmar explicitamente antes da execução. Cancelamento registrado como `cancelled`. |
| 38.18 | Desambiguação em tools | Tools com entity resolver: quando múltiplos candidatos, retorna `disambiguate` step com lista para o usuário escolher. |
| 38.19 | E2E | `flow-commands.spec.ts`, `flow-critical.spec.ts`: fluxos de comando com confirmação. |

**Regras de segurança F38 (auditoria obrigatória):**
- Tools NÃO acessam DB: `grep 'db\.(select|insert|update|delete)' tools/` → ZERO
- LLM não gera SQL: `grep 'sql\`' command-parser.ts` → ZERO
- Áudio não é salvo: `grep 'writeFile|putObject|upload' voice.service.ts` → ZERO
- Registry fechado: `grep 'eval|Function(' ai/` → ZERO

---

## PARTE 8 — BLOCO I: GO-LIVE (Fase 39)

### Fase 39 — Estabilização e Go-Live v1.0.0

**Sessões:** 2-3 | **Dependência:** Todas as fases anteriores

| Etapa | Escopo | Status |
|-------|--------|--------|
| R1 | Dashboard preditivo com dados reais (substituir mocks por `ai.listPredictions`) | ✅ Mergeado |
| R2 | Desambiguação em `resolveClientByName` no flow-engine legado | ✅ Auditado, merge autorizado |
| R3 | E2E expandidos — eliminar `it.skip` sem env guard | ✅ Todos env-guarded |
| R4 | Performance e Lighthouse ≥ 90 | ⏳ Pendente |
| S1 | Storage: bucket bootstrap automático (MinIO) | ⏳ Pendente |
| S2 | Storage: remover fallback silencioso em upload de fotos | ⏳ Pendente |
| S3 | Storage: health check de MinIO/S3 no `/health` | ⏳ Pendente |
| G1 | Checklist Go-Live (todos os gates TRUE) | ⏳ Pendente |

### Checklist Go-Live (G1)

Todos devem ser TRUE antes de `git tag -a v1.0.0`:

**Código:**
- [ ] `pnpm typecheck` — ZERO errors
- [ ] `pnpm lint` — ZERO warnings
- [ ] `pnpm test` — ALL passing (com DB real no CI)
- [ ] `pnpm e2e` — ALL passing
- [ ] `grep -r 'it.skip' apps/` — ZERO (ou env-guarded)
- [ ] `grep -r ': any' apps/ packages/` — ZERO
- [ ] `grep -r 'violet|indigo|neutral-[0-9]' apps/web/` — ZERO
- [ ] `grep -r '@ts-ignore|@ts-nocheck' apps/` — ZERO
- [ ] `grep -r 'protectedProcedure' apps/server/src/modules/` — ZERO (exceto auth/tenants)
- [ ] `npm audit` — ZERO critical/high

**Performance:**
- [ ] Lighthouse ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] Nenhum chunk > 500KB (`vite-bundle-visualizer`)
- [ ] Lazy loading em todas as rotas

**Infraestrutura:**
- [ ] Docker compose prod sobe sem erro
- [ ] Bucket bootstrap automático (MinIO/S3)
- [ ] Health check inclui storage
- [ ] Backup script testado
- [ ] Seed idempotente roda sem erro
- [ ] RUNBOOK.md atualizado
- [ ] `.env.production` sem secrets no repo

**Smoke test funcional:**
- [ ] Login + logout
- [ ] Criar OS completa (com itens, cliente, prazo)
- [ ] Dashboard carrega com dados reais + predições IA
- [ ] Kanban funcional (drag-and-drop)
- [ ] Chat IA responde (texto + criação de OS por NLP)
- [ ] Flow por voz (push-to-talk → transcrição → comando)
- [ ] Estoque: entrada/saída atômica
- [ ] Compras: criar → confirmar → receber (estoque + AP)
- [ ] Curva ABC gera relatório
- [ ] Relatórios fiscais (faturamento, DRE, CSV/PDF)
- [ ] Dark mode toggle
- [ ] Mobile responsivo
- [ ] Portal do cliente via token

### Sequência de Deploy

```bash
# 1. Merge dev → main
git checkout main
git merge dev --no-ff -m "release: v1.0.0 — ProteticFlow Go-Live"

# 2. Tag
git tag -a v1.0.0 -m "ProteticFlow v1.0.0 — Go-Live"
git push origin main --tags

# 3. Deploy
./scripts/deploy.sh production

# 4. Smoke test manual (15min)

# 5. Monitoramento 48h
# Sentry: zero errors | Logs: pino structured | DB: connection pool | Redis: hit rate > 80%
```

### Rollback

```bash
git revert HEAD && ./scripts/deploy.sh production
```

---

## PARTE 9 — INVENTÁRIO ATUALIZADO (dev @ v1.0.0-rc)

### 9.1 Migrations (25 arquivos)

| # | Arquivo | Fase | Conteúdo |
|---|---------|------|----------|
| 0000 | young_kree.sql | F1 | 25 tabelas base |
| 0001 | auth_tables.sql | F2 | refresh_tokens, password_reset_tokens, ALTER users |
| 0002 | tenancy_adjustments.sql | F3 | Contadores em tenants, unique tenant_members |
| 0003 | clientes_precos_adjustments.sql | F4+5 | code/description em price_items |
| 0004 | os_kanban.sql | F6+7 | job_stages, job_photos, order_counters |
| 0005 | financeiro.sql | F8 | cashbook_entries, AR/AP/closings |
| 0006 | entregas_estoque.sql | F9+10 | delivery_schedules, purchase_orders |
| 0007 | funcionarios_folha.sql | F11+12 | employees (36 campos), payroll |
| 0008 | scans_agenda.sql | F13+14 | scans, events |
| 0009 | phase15_settings.sql | F15 | ALTER lab_settings (+14 campos) |
| 0010 | phase16_notifications_idempotency.sql | F16 | unique index deadline_notif_log |
| 0011 | portal_tokens.sql | F17 | portal_tokens |
| 0012 | simulations.sql | F18 | simulations, simulation_items |
| 0013 | ai_sessions.sql | F20 | ai_sessions, ai_messages |
| 0014 | support.sql | F21 | support_tickets, chatbot_conversations |
| 0015 | ai_advanced.sql | F22 | ai_predictions, ai_recommendations |
| 0016 | licensing.sql | F23 | licenses, license_checks |
| 0017 | fiscal.sql | F24+25 | boletos, nfse_records |
| 0018 | audit_logs.sql | F27 | audit_logs |
| 0019 | os_blocks.sql | F30 | os_blocks (reserva de numeração) |
| 0020 | timesheets.sql | F31 | timesheets (ponto digital) |
| 0021 | job_subtypes.sql | F34 | enum job_sub_type, campos proof/rework/suspend/urgent |
| 0022 | purchases_ap_link.sql | F35 | reference_id/type em accounts_payable |
| 0023 | purchases_received_by.sql | F35 | received_by em purchase_orders |
| 0024 | ai_command_runs.sql | F38 | ai_command_runs + enums channel/risk/status |

### 9.2 Módulos Backend (24 diretórios)

```
apps/server/src/modules/
├── agenda/          (F14)       ├── licensing/       (F23)
├── ai/              (F20+32+38)  ├── notifications/   (F16)
├── audit/           (F27)       ├── payroll/          (F12)
├── auth/            (F2)        ├── portal/           (F17)
├── clients/         (F4)        ├── pricing/          (F5)
├── dashboard/       (F26)       ├── purchases/        (F35)
├── deliveries/      (F9)        ├── reports/          (F19+36+37)
├── employees/       (F11)       ├── scans/            (F13)
├── financial/       (F8)        ├── settings/         (F15)
├── fiscal/          (F24+25)    ├── simulator/        (F18)
├── inventory/       (F10)       ├── support/          (F21)
├── jobs/            (F6+34)     ├── tenants/          (F3)
```

### 9.3 Schema DB (24 arquivos)

```
apps/server/src/db/schema/
├── users.ts          ├── licensing.ts       ├── os-blocks.ts
├── tenants.ts        ├── fiscal.ts          ├── timesheets.ts
├── clients.ts        ├── audit.ts           ├── simulations.ts
├── jobs.ts           ├── ai.ts              ├── support.ts
├── financials.ts     ├── ai-advanced.ts     ├── portal.ts
├── materials.ts      ├── lab-settings.ts    ├── scans.ts
├── deliveries.ts     ├── notifications.ts   ├── index.ts
├── employees.ts      ├── agenda.ts
```

### 9.4 Páginas Frontend (60 rotas)

**Auth (5):** login, register, forgot-password, reset-password, layout  
**Dashboard (53):** dashboard, kanban, kanban-tv, flow-ia, ia-avancada, simulador, comissoes, onboarding, planos, landing  
- Clientes: index, novo, [id], [id]/portal  
- Trabalhos: index, novo, [id]  
- Financeiro: index, contas-receber, contas-pagar, fechamento, fluxo-caixa, livro-caixa  
- Estoque: index, materiais, fornecedores, ordens-compra, oc/[id]  
- Compras: index, novo, [id]  
- Funcionários: index, novo, [id]  
- Payroll: index, [id]  
- Entregas: index, [id]  
- Relatórios: index  
- Scans: index, upload, [id]  
- Agenda: index, novo  
- Fiscal: boletos, notas-fiscais  
- Suporte: tickets, chatbot-config  
- Auditoria: index, membros  
- Configurações: index  
**Portal (1):** portal/[token]

### 9.5 E2E Specs (13 arquivos)

| Arquivo | Fase | Fluxo |
|---------|------|-------|
| critical-flow.spec.ts | F28 | Login → criar cliente → criar OS → kanban → concluir |
| secondary-flows.spec.ts | F28 | Estoque, entregas, configurações |
| portal.spec.ts | F17 | Acesso via token, visualização de OS |
| notifications.spec.ts | F16 | Sino, preferências, push |
| settings.spec.ts | F15 | Configurações do lab |
| simulator.spec.ts | F18 | Simulação de orçamento |
| reports.spec.ts | F19 | Geração de relatórios |
| fiscal-reports.spec.ts | F37 | Relatórios fiscais + export |
| job-subtypes.spec.ts | F34 | Prova, remoldagem, urgente |
| purchase-flow.spec.ts | F35 | Compras → estoque → AP |
| flow-commands.spec.ts | F38-O1 | Comandos estruturados |
| flow-critical.spec.ts | F38-O3 | Ações críticas com confirmação |
| flow-voice.spec.ts | F38-O2 | Push-to-talk |

### 9.6 Shared Package

**Validation schemas (26):** ai, audit, auth, client, delivery, employee, event, financial, fiscal, inventory, job, licensing, notification, os-blocks, payroll, portal, pricing, purchase, report, scan, settings, simulation, support, tenant, timesheet  
**Types (12):** ai, audit, auth, dashboard, fiscal, portal, report, settings, simulation, support, tenant, timesheet  
**Constants (4):** job-status, plans, report-types, roles

### 9.7 Core Infrastructure

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Storage (S3/MinIO) | `core/storage.ts` | ✅ S3Client + presigned URLs + upload/download/delete |
| Storage bootstrap | `core/storage-bootstrap.ts` | ⏳ Pendente (F39-S1) |
| Health check | `routes/health.ts` | ✅ DB + Redis (storage pendente F39-S3) |
| Logger | `logger.ts` | ✅ Pino structured |
| Env validation | `env.ts` | ✅ Zod no boot com fail-fast |
| Redis | `redis.ts` | ✅ Connection pool + health check |
| DB | `db/index.ts` | ✅ Drizzle + PostgreSQL 16 |
| Auth | `core/auth.ts` | ✅ JWT + bcrypt + 2FA |
| RBAC | `middleware/rbac.ts` | ✅ 5 roles |
| Rate limiting | `middleware/rate-limit.ts` | ✅ Por tenant |
| Docker dev | `docker/docker-compose.dev.yml` | ✅ PostgreSQL + MinIO + Redis |
| Docker prod | `docker/docker-compose.prod.yml` | ✅ Full stack + Nginx |
| CI | `.github/workflows/ci.yml` | ✅ Lint + typecheck + test + build + tenant isolation + security |

---

## PARTE 10 — ANTI-PATTERNS ADICIONAIS (Descobertos nas Fases 29–38)

### AP-15: Fallback silencioso de storage

```
❌ PROIBIDO — engolir erro de upload e salvar path sem arquivo
try {
  await uploadBuffer(key, buffer, contentType);
} catch {
  logger.warn('MinIO não disponível'); // silencioso
}

✅ OBRIGATÓRIO — erro real se storage não está operacional
await uploadBuffer(key, buffer, contentType);
// Se falhar, o usuário vê o erro e pode agir
```
**Histórico:** `jobs/service.ts` salvava path no banco sem arquivo real quando MinIO não estava rodando. Foto aparecia como "salva" mas era inacessível. Corrigido na F39-S2.

### AP-16: Dashboard com dados mock em produção

```
❌ PROIBIDO — hardcoded mock data em componentes de dashboard
<PredictionCard title="Previsão de Atraso"
  prediction="3 Trabalhos podem atrasar..." confidence={87} />

✅ OBRIGATÓRIO — dados reais via query
const predictions = usePredictions(20);
{predictions.cards.map(card => <PredictionCard key={card.id} {...card} />)}
```
**Histórico:** Dashboard preditivo (F32) foi entregue com 3 cards hardcoded. Corrigido na F39-R1 com hook `usePredictions` + `trpc.ai.listPredictions.useQuery`.

### AP-17: Entity resolver sem desambiguação

```
❌ PROIBIDO — limit(1) sem verificar ambiguidade
const results = await db.select().from(clients)
  .where(ilike(clients.name, `%${name}%`))
  .limit(1);
return results[0]; // silenciosamente ignora outros matches

✅ OBRIGATÓRIO — retorno tipado com status
if (matches.length === 0) return { status: 'not_found' };
if (matches.length === 1) return { status: 'resolved', client: matches[0] };
return { status: 'ambiguous', candidates: matches };
```
**Histórico:** `resolvers.ts:resolveClientByName` fazia `limit(1)` sem desambiguação. IA criava OS para o cliente errado quando nome era parcial. Corrigido na F39-R2.

### AP-18: Tool de IA acessando DB diretamente

```
❌ PROIBIDO — tool fazendo query SQL
// ai/tools/financial-tools.ts
const [ar] = await db.select().from(accountsReceivable).where(...);

✅ OBRIGATÓRIO — tool chama service function existente
const ar = await financialService.getReceivable(tenantId, arId);
```
**Regra:** Tools são adaptadores finos entre o LLM e os services. Toda lógica de negócio, validação e tenant isolation fica nos services. Auditoria: `grep 'db\.(select|insert|update|delete)' tools/` → ZERO.

### AP-19: Cores hardcoded pós-design system

```
❌ PROIBIDO — usar cores Tailwind diretas após F29
className="bg-violet-600 text-indigo-100 border-neutral-700"

✅ OBRIGATÓRIO — usar tokens semânticos
className="bg-primary text-primary-foreground border-border"
```
**Regra permanente:** Após F29/F33, nenhum componente pode usar `violet`, `indigo`, ou `neutral-[0-9]`. Apenas tokens CSS: `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--destructive`, `--warning`, `--success`.

---

## PARTE 11 — PADRÕES DE FALHA DOS AGENTES (Atualizado)

### Codex / Claude Code

| Padrão | Mitigação |
|--------|-----------|
| Espiral de escopo (modifica módulos aprovados) | Lista fechada de arquivos permitidos no prompt |
| Stubs silenciosos (email, PDF, push) | Grep por `stub\|success: true\|logger.info.*email` |
| E2E placeholder (`it.skip` vazio) | Grep por `it.skip` sem env guard |
| Junk files (`.claude/`, `.tmp/`, `.swarm/`) | `git diff --name-only` antes de aprovar |
| Branch errada (base point incorreto) | Verificar `git merge-base` |
| CRLF em arquivos | Grep por `\r` nos arquivos novos |
| Migration com número conflitante | Verificar sequência antes de aprovar |
| Fallback silencioso de storage | Abrir `service.ts` e verificar try/catch que engole erros |

### Antigravity / Gemini

| Padrão | Mitigação |
|--------|-----------|
| Sobrescreve design system (sky → indigo) | Grep `violet\|indigo\|neutral-[0-9]` SEMPRE |
| Introduz `any` | Grep `: any\|as any` nos alterados |
| Path alias `@/` sem config | Grep `from '@/` |
| Não roda gates | Exigir output de typecheck+lint+test |

---

## PARTE 12 — ROADMAP PÓS v1.0.0

| Fase | Módulo | Prioridade | Dependência |
|------|--------|-----------|-------------|
| 40 | WhatsApp Business API (req 24.10) | Alta | F21 (Suporte) |
| 41 | Multi-Empresa / Filiais (M26) | Média | `parentTenantId` já existe no schema |
| 42 | Aprendizado contextual da IA (req 13.22) | Média | F38 |
| 43 | Precificação dinâmica (req 20.11) | Baixa | F36 (Curva ABC) |
| 44 | Migração de dados legado (scripts por domínio) | Alta | Go-live |

**Nenhuma fase pós v1.0.0 bloqueia o lançamento.**

---

## TOTALIZAÇÃO FINAL

| Métrica | Valor |
|---------|-------|
| Fases concluídas | 38 (F1–F38) |
| Fase em andamento | F39 (Go-Live) |
| Migrations | 25 (0000–0024) |
| Módulos backend | 24 |
| Páginas frontend | 60 |
| E2E specs | 13 |
| Testes backend | 41 arquivos |
| Schemas DB | 24 arquivos |
| Validation schemas (shared) | 26 |
| Requisitos PRD original | 289 |
| Requisitos adicionais (F29-F38) | ~65 |
| Anti-patterns documentados | 19 (AP-01 a AP-19) |
| Padrões mandatórios | 8 (PAD-01 a PAD-08) |

---

*Documento gerado em 2026-04-07. Complementa PRD v3.3 (Partes 1 e 2). Em caso de conflito entre este documento e os anteriores para Fases 29+, este prevalece.*
