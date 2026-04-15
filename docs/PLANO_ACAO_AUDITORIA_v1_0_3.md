# Plano de Acao - Auditoria Humana v1.0.3
**Data:** 2026-04-10
**Base:** Testes de usuario final em ambiente local (Auditoria Humana.md)
**Fonte de verdade desta rodada:** a auditoria humana prevalece sobre PRDs e documentos historicos sempre que houver conflito entre documentacao anterior e comportamento validado em uso real. Depois dos fixes, os documentos estruturais devem ser atualizados para refletir a operacao correta.
**Total de issues:** 40 itens organizados em 4 sprints

---

## DIAGNOSTICO GERAL

A maioria dos backends existe, mas a entrega real ainda quebra em 4 frentes:

1. **Frontend nao conectado ao backend** — botoes, submits e exports nao chamam a mutation/query correta
2. **Regra de negocio aplicada errado** — remoldagem fecha OS, cobra e cria outra quando deveria apenas pausar a mesma OS
3. **Integracao financeira incompleta** — compras e materiais nao fecham o ciclo automatico com despesas/contas a pagar
4. **Licenciamento desalinhado com a estrategia comercial** — precisamos de janelas de "acesso total temporario" antes da volta aos limites do plano

---

## SPRINT 1 — CRITICOS (Bloqueiam uso real)
**Estimativa:** 3-4 dias | **Impacto:** sem esses fixes, ninguem usa o sistema

| # | Modulo | Issue | Root Cause | Acao |
|---|--------|-------|-----------|------|
| 1 | TRABALHO | Remoldagem da baixa + lanca nova OS = cobranca duplicada | A acao de remoldagem foi implementada como fechamento com retrabalho: baixa financeira, encerra a OS atual e abre outra cobranca | Reescrever o fluxo de remoldagem para pausar a MESMA OS na linha de producao aguardando retorno da moldagem. Criar/usar status operacional `rework_in_progress` (ou equivalente canonico), guardar etapa anterior, bloquear baixa financeira, bloquear criacao automatica de nova OS e bloquear nova cobranca ate a retomada |
| 2 | TRABALHO | "Download OS" redireciona para dashboard | Frontend: handler do botao provavelmente usa `navigate('/')` ou faz window open mal configurado | Fix no componente de detalhe da OS — chamar `jobs.generatePdf` e abrir o blob URL, nao navegar |
| 3 | TRABALHO | Remover "Concluido com Remoldagem", adicionar "Suspenso" e formalizar "Remoldagem" como pausa operacional | `completed_with_rework` esta modelado/visivel como status final, mas o comportamento correto de remoldagem nao e conclusao; `suspended` precisa existir como status formal separado de remoldagem | Remover `completed_with_rework` do fluxo visivel/final. Adicionar `suspended` como status formal. Manter remoldagem como estado operacional de pausa (`rework_in_progress`) da mesma OS. Atualizar `VALID_TRANSITIONS`, `JOB_STATUS_LABELS`, `JOB_STATUS_COLORS`, `KANBAN_COLUMNS`, filtros e relatorios |
| 4 | ENTREGA | Novo Roteiro nao "Cria" | O fluxo atual de criacao esta no modal da pagina `entregas/index.tsx`, e o submit provavelmente nao chama a mutation correta | Debug `apps/web/src/app/(dashboard)/entregas/index.tsx` — verificar estado do modal, payload e chamada real de `createSchedule` no botao "Criar Roteiro" |
| 5 | FUNCIONARIOS | Nao cadastra novo funcionario | Backend `licensedProcedure` funciona, service existe. Provavel bug no form frontend | Debug `apps/web/src/app/(dashboard)/funcionarios/novo.tsx` — verificar validacao Zod e mutation call |
| 6 | COMPRAS | Nova Compra nao salva, sem quantidade/valor e sem lancamento automatico em despesas | O form nao expoe/persiste todos os campos dos itens e o fluxo compra -> financeiro nao esta fechando automaticamente | Corrigir `apps/web/src/app/(dashboard)/compras/novo.tsx` para capturar quantidade e valor por item, persistir em `purchases.create` e, na confirmacao da compra, criar automaticamente (a) despesa em `expenses` e (b) conta a pagar em `accounts_payable` vinculadas a compra, dentro de `db.transaction()`, sem exigir lancamento manual pelo usuario |
| 7 | FLOW IA | Responde "dificuldades tecnicas" | Erro real esta sendo mascarado por mensagem generica; pode ser chave ausente, provider indisponivel ou excecao nao tratada | Melhorar observabilidade e UX: classificar causa do erro no backend, logar causa real e exibir mensagem especifica no frontend (ex: chave ausente, limite esgotado, indisponibilidade temporaria) |
| 8 | FINANCEIRO | Calendario nao funciona no Lancamento Avulso | Componente date-picker provavelmente com bug de renderizacao ou evento nao propagando | Debug componente de lancamento avulso — verificar se o date-picker shadcn esta configurado corretamente |

---

## SPRINT 2 — FUNCIONAIS (Features quebradas que impedem workflow completo)
**Estimativa:** 3-4 dias | **Impacto:** usuario consegue usar o basico mas fluxos secundarios falham

| # | Modulo | Issue | Root Cause Provavel | Acao |
|---|--------|-------|-----------|------|
| 9 | RELATORIOS | "Dispara Agora" falha com "ISPDF is not a constructor" | Import incorreto de jsPDF no frontend. Provavelmente `import { jsPDF }` vs `import jsPDF` ou `new jsPDF()` vs `new jsPDF.jsPDF()` | Fix import de jsPDF em `apps/web/src/app/(dashboard)/relatorios/index.tsx`. Verificar versao instalada e export padrao |
| 10 | RELATORIOS | Nao exporta PDF | Mesmo root cause do #9 — jsPDF import quebrado | Corrigido junto com #9 |
| 11 | RELATORIOS | Botoes Grafico e Breakdown nao funcionam | Handlers nao conectados ou condicional escondendo conteudo | Debug `report-actions.tsx` — verificar onClick handlers |
| 12 | RELATORIOS | Email em caixa alta ao digitar | CSS `text-transform: uppercase` no input, ou toUpperCase() no onChange | Remover transformacao de texto no campo de email |
| 13 | FATURAMENTO | Exportar PDF nao funciona | Mesmo pattern: jsPDF import ou handler desconectado | Fix junto com sprint de PDF (#9) |
| 14 | DESPESAS | Exportar tabelas nao funciona | Handler de export nao conectado | Implementar export CSV/XLSX no componente de despesas |
| 15 | DRE | Exportar PDF nao funciona | Pattern repetido de PDF export | Fix junto com sprint de PDF |
| 16 | CURVA ABC | Gerar Relatorio + exportar PDF nao funcionam | Backend pode ter a query, frontend nao conecta | Debug + fix `curva-abc` page |
| 17 | COMISSOES | Exportar CSV nao funciona | Handler de export desconectado | Implementar download CSV no frontend |
| 18 | SIMULADOR | Salvar Simulacao nao funciona | Mutation nao conectada ou validation falhando silenciosamente | Debug `simulador.tsx` — verificar mutation e error handling |
| 19 | SIMULADOR | Enviar PDF por email nao funciona | Depende de SMTP configurado + PDF generation | Fix: verificar SMTP config, conectar handler |
| 20 | FISCAL | Gerar boleto manual nao funciona | A falha pode estar na integracao com gateway, configuracao ausente ou erro nao tratado | Implementar diagnostico explicito da integracao, validar credenciais/config e retornar mensagem util para o usuario em vez de falha silenciosa |
| 21 | ESTOQUE | "Detalhes" do material redireciona para dashboard | Link/navigate com path errado no componente de listagem | Corrigir o link em `apps/web/src/app/(dashboard)/estoque/index.tsx` para a rota real de detalhe do material |
| 22 | ESTOQUE | Material sem quantidade/valor visivel no registro e sem vinculo automatico com despesas | Formulario nao coleta/mostra quantidade e custo, e o fluxo financeiro da entrada nao esta padronizado | Adicionar quantidade inicial e custo unitario no registro de material. Regra: entrada direta de material (sem compra vinculada) cria automaticamente despesa + conta a pagar; entrada via compra NAO duplica — reaproveita o lancamento ja criado por `purchases.confirm` (#6). Garantir idempotencia por `sourceType+sourceId` |

---

## SPRINT 3 — UX E AJUSTES (Melhoram experiencia mas nao bloqueiam)
**Estimativa:** 2-3 dias | **Impacto:** polimento para producao

| # | Modulo | Issue | Acao |
|---|--------|-------|------|
| 23 | KANBAN | Adicionar abas "Remoldagem" e "Suspenso" | Apos Sprint 1: adicionar `rework_in_progress` e `suspended` a `KANBAN_COLUMNS` e aos filtros/abas do quadro |
| 24 | KANBAN | Modo TV: logo ProteticFlow → logo do lab + "Powered by ProteticFlow" | Alterar `kanban-tv.tsx` — buscar logo do tenant via `tenantSettings.logoUrl`, adicionar badge discreto "Powered by ProteticFlow" |
| 25 | CLIENTES | Tipo de pessoa invisivel ate hover | Bug de CSS — provavelmente `opacity: 0` ou `color` igual ao background. Fix no componente de tipo de pessoa |
| 26 | CLIENTES | Convite Digital nao funcional | Backend do portal token existe e funciona. Verificar se o botao no frontend chama `portal.sendPortalLink` corretamente |
| 27 | TRABALHO | Tabela de auditoria (selecao de tabelas) deve ficar no cadastro de clientes, nao na OS | Mover componente `PriceTableSelector` da tela de criacao de OS para a tela de edicao do cliente. Na OS, herdar tabela do cliente |
| 28 | FINANCEIRO | Card Debito/Saida deve ficar vermelho quando selecionado | Adicionar classe condicional `bg-destructive/10 border-destructive` quando tipo = debito esta ativo |
| 29 | ENTREGA | OS que recebe baixa nao atualiza o roteiro de entregas e nao carrega endereco da clinica do dentista | Quando a OS muda para status terminal (`ready` → `delivered`, ou via `jobs.giveBaixa`), o servico deve, dentro da mesma transacao: (1) localizar o `delivery_schedule_item` vinculado e marca-lo como entregue; (2) **puxar automaticamente o endereco da clinica** a partir de `dentists.clinicAddress` (via `jobs.dentistId`) e materializar em `delivery_schedule_items.deliveryAddress` se estiver vazio — sem sobrescrever se o operador ja editou manualmente. Fluxo bidirecional: marcar item como entregue no roteiro dispara baixa na OS se ela estiver em `ready`. **Data de entrega do roteiro e autonoma** — pode ser editada no proprio roteiro sem alterar a OS (o roteiro define quando o motorista sai, nao a OS). Tratar caso de OS em multiplos roteiros ativos sem criar inconsistencia |
| 30 | ENTREGA | Novo Roteiro deve ter endereco e suportar 2 tipos de parada: entrega e busca | O roteiro nao e so para entregas — tambem e usado para o motorista buscar moldagens/trabalhos nas clinicas. Adicionar ao schema de `delivery_schedule_items`: `stopType: 'delivery' \| 'pickup'` e `deliveryAddress` (text). No frontend do modal de criacao, permitir adicionar paradas dos dois tipos na mesma rota. Para `delivery`: endereco default vem de `dentists.clinicAddress` via OS. Para `pickup`: endereco tambem vem do dentista, mas o item nao precisa de OS vinculada (pode ser busca de moldagem nova). Ambos editaveis pelo operador. Renomear rotulos do modulo de "Entregas" para "Roteiros" quando fizer sentido, mantendo retrocompatibilidade de rota |
| 31 | AGENDA | Novo evento nao vincula OS ao dentista | Verificar se o form de criacao de evento tem select de OS e de dentista (client). Conectar ao backend |
| 32 | CONFIGURACOES | Redefinir Credencial / Logs de acesso nao funcionam | Implementar mutation de reset password e query de audit logs na tela de perfil |
| 33 | CONFIGURACOES | Convidar Membro nao funciona | Verificar `tenantUsers.invite` mutation — provavelmente depende de SMTP para envio de email de convite |
| 34 | CONFIGURACOES | Notificacoes — botoes nao funcionam | Conectar handlers de toggle de notificacao ao backend `settings.updateNotificationPrefs` |
| 35 | FOLHA PGTO | Implementar "desfazer Fechar Folha" | Adicionar mutation `payroll.reopenPeriod` no backend + botao no frontend. Validar que nao ha pagamentos ja processados |

---

## SPRINT 4 - PLANOS E LIMITES (Feature nova estrategica)
**Estimativa:** 2-3 dias | **Impacto:** necessario para monetizacao

| # | Modulo | Issue | Acao |
|---|--------|-------|------|
| 36 | PLANOS | TRIAL - 14 dias de acesso total; depois vira freemium ultra-restrito (demo, nao operacional) | Modelar o `trial` em 2 janelas: `fullAccessDays: 14`; depois aplicar `{ labs: 1, clients: 10, jobsPerMonth: 10, users: 1, priceTables: 1, aiEnabled: false, managerActionsPerMonth: 10, hasFinancial: false, hasReports: false }`. Sem IA de nenhuma forma (Flow IA bloqueado, comandos de voz bloqueados, sugestoes IA bloqueadas). Limite total de 10 acoes de escrita no gerenciador por mes (criar cliente, criar OS, editar etc. contam no mesmo balde), reset mensal no dia 1 |
| 37 | PLANOS | STARTER - 30 dias de acesso total; depois volta ao plano contratado | Modelar `starter` com `fullAccessDays: 30`; depois aplicar `{ labs: 1, clients: 20, jobsPerMonth: 100, users: 3, priceTables: 2, ai: basic, voiceCommands: false, managerActionsPerMonth: null, hasFinancial: true, hasReports: true }` |
| 38 | PLANOS | PRO - 30 dias de acesso total; depois volta ao plano contratado | Modelar `pro` com `fullAccessDays: 30`; depois aplicar `{ labs: 3, clients: 50, jobsPerMonth: 300, users: 10, priceTables: 5, ai: full, voiceCommands: true, managerActionsPerMonth: null, hasFinancial: true, hasReports: true }` |
| 39 | PLANOS | ENTERPRISE - ilimitado | Garantir `enterprise` sem limites de uso (labs/clientes/jobs/usuarios/tabelas), IA completa + voz, financeiro completo, relatorios completos e sem janela de reducao pos-degustacao |
| 40 | SUPORTE | Adicionar canal de sugestoes de usuarios | Criar secao dedicada em `Suporte` para receber sugestoes: formulario com titulo, descricao, categoria e impacto percebido; listagem das sugestoes enviadas pelo tenant; status inicial `recebida`; auditoria de autor/data; endpoint e UI conectados no fluxo de suporte |

**Implementacao:** atualizar seed de planos e licensing, armazenar a janela promocional de acesso total (`fullAccessUntil` ou equivalente) por tenant/plano, ajustar `licensedProcedure` (ou middleware de licenca) para aplicar a regra correta antes e depois da degustacao, criar/usar contador `managerActionsThisMonth` para trial pos-14d (reset no dia 1), bloquear rotas de IA quando `aiEnabled:false`, e aplicar feature gating de financeiro/relatorios no backend e frontend.

**Posicionamento do TRIAL:** e uma janela de 14 dias com tudo liberado para experimentacao. Apos esse periodo, o modo demo permanece altamente restrito (10 acoes/mes e sem IA/financeiro/relatorios), servindo apenas para continuidade minima ate conversao em plano pago.

**Estrategia comercial - "deixar provar o doce":** acesso total temporario em todos os planos de entrada (14 dias no trial, 30 dias no starter e pro) para demonstrar valor completo antes da volta aos limites contratados. Transparencia obrigatoria em banner sobre data de corte e limites aplicados apos a janela.

**Resumo dos limites pos-degustacao:**

| Plano | Labs | Clientes | Jobs/mes | Usuarios | Tabelas | IA | Acoes/mes | Financeiro | Relatorios |
|-------|------|----------|----------|----------|---------|-----|-----------|------------|------------|
| TRIAL (pos 14d - demo) | 1 | 10 | 10 | 1 | 1 | nao | 10 totais | nao | nao |
| STARTER (pos 30d) | 1 | 20 | 100 | 3 | 2 | basica, sem voz | ilimitado | sim | sim |
| PRO (pos 30d) | 3 | 50 | 300 | 10 | 5 | completa + voz | ilimitado | sim | sim |
| ENTERPRISE | ilimitado | ilimitado | ilimitado | ilimitado | ilimitado | completa + voz | ilimitado | sim | sim |

---

## PADROES RECORRENTES (resolver uma vez, corrige varios)

### Padrao A: PDF Export Quebrado (afeta #9, #10, #13, #15, #16, #19)
**Root cause unico provavel:** import/instanciacao de jsPDF no frontend esta inconsistente entre telas.
**Acao:** criar util centralizado `apps/web/src/lib/pdf-export.ts` para encapsular o import correto do jsPDF e o fluxo de download/envio.

### Padrao B: Botao Redireciona para Dashboard (afeta #2, #21)
**Root cause:** Links/navigates com path relativo errado ou catch nao tratado que faz fallback para `/`.
**Acao:** varrer handlers por `navigate('/')`, `router.push('/')` e fallbacks silenciosos, corrigindo caso a caso.

### Padrao C: Mutation Nao Conectada (afeta #4, #5, #6, #18, #26, #33, #34)
**Root cause:** Frontend tem o formulario mas o `onSubmit` nao chama a tRPC mutation, ou chama mas nao trata o sucesso/erro.
**Acao:** em cada componente, verificar a cadeia completa: form -> onSubmit -> mutation.mutate()/mutateAsync -> onSuccess -> onError -> invalidacao/refetch.

### Padrao D: Regra de negocio implementada errado (afeta #1, #6, #22, #29, #36-39)
**Root cause:** o codigo existe, mas a semantica operacional nao bate com o uso real do laboratorio.
**Acao:** para esses itens, escrever primeiro o comportamento esperado validado pela auditoria humana e so depois codificar. Sem assumir que a regra antiga do sistema esta correta.

---

## ORDEM DE EXECUCAO RECOMENDADA

```
Semana 1: Sprint 1 (items 1-8)  — desbloqueia uso real
Semana 2: Sprint 2 (items 9-22) - comecar pelo Padrao A (PDF)
Semana 3: Sprint 3 (items 23-35) - polimento UX e coerencia operacional
Semana 4: Sprint 4 (items 36-40) - licenciamento, estrategia comercial e canal de sugestoes
```

Ao final de cada sprint: tag + deploy (`v1.0.3`, `v1.0.4`, etc.) somente depois da auditoria da sprint.

---

## NOTA SOBRE O PROTOCOLO DE AUDITORIA

O documento `PROTOCOLO_AUDITORIA_BRANCHES_Claude Sonnet 4.6.md` define um processo rigoroso de auditoria de branches (Blocos A-F) que deve ser seguido antes de qualquer merge. O protocolo foi criado apos falhas reais de auditoria (stubs aprovados como implementados, `it.skip` nao detectados, espiral de escopo). **Aplicar obrigatoriamente em cada PR deste plano.**
