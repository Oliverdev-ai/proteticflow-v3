## Descrição

<!-- Resumo do que foi feito neste PR -->

**Fase:** <!-- Ex: Fase 4 — Clientes -->
**Módulo PRD:** <!-- Ex: Módulo 03 (03.01-03.10) -->
**Bloco:** <!-- Ex: Bloco B — Core CRUD -->

## Tipo de mudança

- [ ] `feat` — Nova funcionalidade
- [ ] `fix` — Correção de bug
- [ ] `refactor` — Refatoração (sem mudança de comportamento)
- [ ] `test` — Adição/correção de testes
- [ ] `chore` — Infraestrutura, CI, dependências
- [ ] `docs` — Documentação

## Definition of Done (PRD v3.3, seção 2.3)

### Funcional
- [ ] Schema Drizzle criado com `tenantId` em toda tabela de negócio
- [ ] Migration gerada e executável (`pnpm db:push`)
- [ ] Service layer com funções tipadas (`tenantId` como primeiro parâmetro)
- [ ] Router tRPC com procedures usando middleware correto (RBAC + `licensedProcedure`)
- [ ] Página frontend funcional com estados: loading, empty, error, success
- [ ] Link na sidebar com ícone (respeitando RBAC)
- [ ] Zod schemas compartilhados em `packages/shared`

### Qualidade
- [ ] Testes: create, list, update, delete + RBAC + tenant isolation
- [ ] Zero `any` no TypeScript
- [ ] CI verde (lint + types + tests + build + tenant-isolation-check)

### Observabilidade (PRD seção 2.9)
- [ ] Logs estruturados em operações de escrita (`{ action, tenantId, userId, entityId }`)
- [ ] Pelo menos 1 métrica de negócio exposta

### Anti-Patterns verificados (PRD Parte 6)
- [ ] AP-01: Nenhuma query sem filtro de `tenantId`
- [ ] AP-02: Preços congelados (snapshot) nos itens da OS
- [ ] AP-13: Operações numéricas são atômicas (UPDATE com SQL inline)
- [ ] AP-14: Operações multi-tabela dentro de `db.transaction()`

## Handoff (PRD seção 2.8)

### O que foi feito
<!-- Lista de entregáveis concluídos -->

### Decisões tomadas
<!-- Ex: "Usei pg_trgm para busca fuzzy em vez de ILIKE" -->

### Debt técnico aceito (se houver)
<!-- Ex: "Paginação offset simples — cursor-based fica para otimização futura" -->

### Próxima fase depende de
<!-- Ex: "Schema de clients e pricing estarem no banco" -->

## Testes adicionados

- Total de testes neste PR: **X**
- Testes de fases anteriores passando: **sim/não**

## Screenshots (se mudança visual)

<!-- Adicionar screenshots de páginas novas ou modificadas -->
