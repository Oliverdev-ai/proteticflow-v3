# CLAUDE.md — ProteticFlow v3

> Arquivo de instruções para agentes IA (Claude, Codex, etc.) trabalhando neste repositório.
> Leia antes de qualquer ação. Este arquivo é a lei local — prevalece sobre qualquer instrução genérica.

---

## 1. CONTEXTO DO PROJETO

**Produto:** SaaS de gestão para laboratórios de prótese dentária. Primeiro do Brasil com IA embarcada.
**Status:** ✅ v1.0.2 em produção (go-live 2026-04-08)
**Equipe:** 1 coordenador humano + agentes IA (Claude, Codex)
**PRD (fonte de verdade):** `PRD_PARTE_1_de_3.md`, `PRD_PARTE_2_de_3.md`, `PRD_PARTE_3_de_3.md`
**Repo:** `github.com/Oliverdev-ai/proteticflow-v3`

Se houver conflito entre este arquivo e qualquer outro documento, **este arquivo prevalece para instruções de processo**. Para requisitos de produto, o PRD prevalece.

---

## 2. STACK (NÃO NEGOCIÁVEL)

```
Node.js 22 LTS + TypeScript strict
Backend:  Express + tRPC v11 + Drizzle ORM + PostgreSQL 16 + Redis 7
Frontend: React 19 + Vite 7 + shadcn/ui + Tailwind CSS 4
Storage:  MinIO (dev) / AWS S3 (prod)
Monorepo: Turborepo + pnpm
Deploy:   Docker Compose → GHCR → Railway/Render
CI/CD:    GitHub Actions
```

**Não introduzir dependências fora desta stack sem ADR documentado em `docs/`.**

---

## 3. REGRAS INEGOCIÁVEIS (CI QUEBRA SE VIOLADAS)

### 3.1 TypeScript Strict
- Zero `any`. Zero `@ts-ignore`. Zero arquivos `.js`.
- Tipos compartilhados vivem em `packages/shared`.
- Se o tipo não existe, criar — nunca usar `as any` como atalho.

### 3.2 Multi-Tenancy
- **Toda query de negócio DEVE filtrar por `tenantId`.**
- Padrão: `and(eq(table.tenantId, ctx.tenantId), ...)` no WHERE.
- Tabelas globais (planos, features flags): comentar `// tenant-isolation-ok` na linha da query.
- Gate de CI: `pnpm --filter server check:tenant-isolation` — ZERO violações é o requisito.

### 3.3 Concorrência e Financeiro
- UPDATE de estoque/financeiro: **atômico via SQL**, nunca read-compute-write separado.
  ```typescript
  // CORRETO
  await tx.execute(sql`UPDATE stock SET qty = qty - ${n} WHERE qty >= ${n}`);
  // ERRADO
  const item = await db.select(); item.qty -= n; await db.update(item);
  ```
- Operações multi-tabela: sempre `db.transaction(async (tx) => { ... })`.
- Preço em OS: **snapshot imutável** em `job_items.unitPriceCents`. Nunca recalcular a partir da tabela de preços para OS existente.

### 3.4 Segurança
- RBAC em toda `protectedProcedure` — verificar role antes de qualquer operação sensível.
- Audit log em toda escrita (create/update/delete) em recursos críticos.
- Segredos exclusivamente em variáveis de ambiente — nunca hardcoded, nunca commitados.
- Áudio de voz: processado em memória, **nunca persistido em storage**.
  Gate: `grep 'writeFile|putObject|upload' apps/server/src/services/voice.service.ts` → ZERO.

### 3.5 Design System
- **Accent color: `sky-500` (light) / `sky-400` (dark). PERMANENTE.**
- Zero `violet`, `indigo`, `purple`, `neutral-[0-9]` em qualquer componente.
- Tokens semânticos obrigatórios: `--primary`, `--muted`, `--border`, `--destructive`, `--warning`, `--success`.
- PR com cor proibida → reprovado automaticamente.

### 3.6 Módulo Completo ou Inexistente
Nenhum módulo pode existir parcialmente. A sequência obrigatória é:
```
Schema (Drizzle) → Migration → Service → Router (tRPC) → Testes (Vitest) → Página (React) → Link na Sidebar
```

---

## 4. GATES DE CI (TODOS DEVEM PASSAR)

```bash
pnpm typecheck                              # zero erros TS
pnpm lint                                  # zero warnings ESLint
pnpm test                                  # cobertura mínima mantida
pnpm --filter server check:tenant-isolation # zero vazamentos de tenant
pnpm audit --audit-level=critical          # zero CVEs críticos
# Lighthouse: Performance ≥ 80, Acessibilidade ≥ 90
```

**Não mergear sem CI verde. Não fazer `git push --force` em `main`.**

---

## 5. FLUXO DE DESENVOLVIMENTO

### Branch strategy
```
main    → produção (tags vX.Y.Z disparam deploy)
dev     → staging (push dispara deploy staging)
feature → PR para dev → squash merge
```

### Sequência para nova feature
1. Branch `feature/NNN-descricao` a partir de `dev`
2. Implementar schema → migration → service → router → testes → UI
3. `pnpm typecheck && pnpm lint && pnpm test` — todos verdes localmente
4. PR para `dev` → CI verde → merge
5. Após validação em staging: PR `dev → main` → tag `vX.Y.Z`

### Migrações de banco
```bash
pnpm --filter server db:generate   # gera arquivo de migration
pnpm --filter server db:migrate    # aplica em ordem (usa baseline script)
# NUNCA usar db:push em staging/prod — apenas db:migrate
```

---

## 6. AMBIENTE LOCAL (DESENVOLVIMENTO)

### Pré-requisitos
- Node.js 22+, pnpm 9+, Docker Desktop

### Setup inicial (primeira vez)
```bash
# 1. Instalar dependências
corepack enable && corepack prepare pnpm@9 --activate
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env: gerar JWT_SECRET e SETTINGS_SECRET_KEY com:
# openssl rand -base64 64

# 3. Subir infraestrutura (PostgreSQL + Redis + MinIO)
docker compose -f docker/docker-compose.dev.yml up -d

# 4. Criar bucket MinIO (primeira vez apenas)
# Acessar http://localhost:9001 — usuário: minioadmin / minioadmin123
# Criar bucket chamado "proteticflow"

# 5. Aplicar schema
pnpm --filter server db:push

# 6. (Opcional) Seed de demonstração
pnpm --filter server db:seed
# Login demo: admin@demo.proteticflow.com.br / Demo123!

# 7. Rodar
pnpm dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

### Rotina diária
```bash
docker compose -f docker/docker-compose.dev.yml up -d
pnpm dev
```

### Parar (SEM perder dados)
```bash
docker compose -f docker/docker-compose.dev.yml stop
# NÃO usar "down -v" — apaga todos os volumes (dados perdidos)
```

### Dados persistem em
- PostgreSQL → volume `postgres_data`
- Arquivos/uploads → volume `minio_data`
- Cache → volume `redis_data`

---

## 7. PADRÕES DE CÓDIGO

### Nomenclatura
- Tabelas Drizzle: `snake_case` singular (`job_item`, `tenant_user`)
- Routers tRPC: `camelCase` por domínio (`jobs`, `clients`, `financials`)
- Componentes React: `PascalCase` — um componente por arquivo
- Hooks: prefixo `use` (`useJobList`, `useTenantSettings`)

### Estrutura de um router tRPC (padrão)
```typescript
export const exampleRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().default(1) }))
    .query(async ({ ctx, input }) => {
      return exampleService.list(ctx.tenantId, input);
    }),
  create: protectedProcedure
    .input(CreateExampleSchema)
    .mutation(async ({ ctx, input }) => {
      return exampleService.create(ctx.tenantId, ctx.userId, input);
    }),
});
```

### Estrutura de um service (padrão)
```typescript
// Services recebem tenantId como primeiro parâmetro — SEMPRE
export const exampleService = {
  async list(tenantId: string, input: ListInput) {
    return db.select().from(examples)
      .where(and(
        eq(examples.tenantId, tenantId), // tenant-isolation-ok se global
        // demais filtros
      ));
  },
};
```

---

## 8. DEPLOY

### Imagens Docker (GHCR)
```
ghcr.io/oliverdev-ai/proteticflow-v3/server:vX.Y.Z
ghcr.io/oliverdev-ai/proteticflow-v3/web:vX.Y.Z
```

### Publicar nova versão em produção
```bash
git tag vX.Y.Z
git push origin vX.Y.Z
# GitHub Actions cuida do resto:
# build server + web → push GHCR → criar GitHub Release
```

### Permissions obrigatórias no workflow deploy
```yaml
permissions:
  contents: write   # criar GitHub Release
  packages: write   # push no GHCR
```

### Variáveis de ambiente de produção
Gerenciadas na plataforma de hospedagem (Railway/Render). **Nunca em arquivos commitados.**

---

## 9. REFERÊNCIA LEGADA

**`github.com/Oliverdev-ai/proteticflow`** (Django + proteticflow-ui)
- 56 models Django, 1561 campos — usar como **piso de completude de dados**
- Lógica de negócio pura (financeiro, XML, PDF) pode ser portada
- Arquitetura (autenticação, queries, tenant) NÃO deve ser reaproveitada — foi reescrita

---

## 10. INSTRUÇÕES PARA AGENTES IA

### O que fazer
- Ler este arquivo e o napkin (`.claude/napkin.md`) no início de cada sessão
- Verificar estado real do código antes de assumir o que existe
- Propor mudanças com raciocínio explícito antes de implementar
- Rodar gates de CI localmente antes de declarar "pronto"

### O que NÃO fazer
- Acessar banco de dados diretamente de tools/scripts de IA — chamar service functions
- Usar `any`, `@ts-ignore` ou contornar o sistema de tipos
- Mergear sem CI verde
- Fazer `down -v` no docker-compose de desenvolvimento
- Introduzir cores `violet/indigo/purple` em qualquer componente
- Criar módulo pela metade (schema sem router, router sem testes, etc.)
- Reimplementar algo que já existe — verificar antes

### Quando em dúvida
PRD > este arquivo > README > qualquer outra fonte.
Se o PRD não cobre, perguntar ao coordenador antes de inventar.
