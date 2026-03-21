## Handoff — Fase 02: Auth (Módulo 01.01–01.13)

> Seguindo o template da seção 2.8 do PRD (Parte 2).

---

### O que foi feito

- Implementação completa do `auth/service.ts`: register, login, refresh, logout, forgotPassword, resetPassword, changePassword, updateProfile, setup2FA, verify2FA, disable2FA, createUser, listUsers, getPermissions, exportUserData
- Router tRPC (`auth/router.ts`) com segregação correta de procedures: `publicProcedure`, `protectedProcedure`, `adminProcedure`
- Schema Drizzle: `users`, `refresh_tokens`, `password_reset_tokens` com `tenantId` preparado
- Migration `0000_young_kree.sql` gerada e versionada
- `packages/shared/src/validation/auth.schema.ts`: todos os schemas Zod compartilhados front+back
- `packages/shared/src/constants/roles.ts`: enum + `ROLE_PERMISSIONS` mapeando cada role a sua lista de módulos
- Frontend: `App.tsx` com React Router v7, `login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`
- Tailwind CSS v4 configurado via `@tailwindcss/vite`
- `/health` endpoint disponível em `routes/health.ts`

### Decisões tomadas

- **`role` global = `'user'`** no `createUser`: o sistema de roles multi-nível por tenant (`gerente`, `producao`, etc.) é resolvido via `tenant_memberships`, a ser implementado na Fase 3.
- **`listUsers` retorna `[]`** como stub seguro: isolamento por tenant depende de `tenant_memberships` (Fase 3). Um `logger.warn` sinaliza explicitamente que a implementação está pendente.
- **`forgotPassword` não loga o token real**: em produção só loga um stub; em dev loga os 8 primeiros chars. Evita credential leak no log.
- **Migration `0001` manual**: `drizzle-kit generate` falha no Windows ESM (drizzle-kit bundla como CJS, tenta `require()` de ESM modules do `shared`). A migration foi escrita à mão e o journal atualizado. O snapshot JSON da `0001` não existe.

### Debt técnico aceito intencionalmente

| Item | Justificativa | Quando resolver |
|------|--------------|----------------|
| Snapshot `0001` ausente | drizzle-kit ESM bug no Windows | Fase 3: rodar `drizzle-kit introspect` no ambiente Docker/Linux para sincronizar |
| Testes frontend (≥ 70%) | Sem Vitest + Testing Library configurados | Fase 3: configurar junto com o primeiro componente de negócio |
| Playwright E2E | Não adicionado ao projeto | Fase 3: instalar e criar smoke test de login/logout |
| `gitleaks` no CI | Ausente — evidenciado pelo `create-db.js` com senha hardcoded (já deletado) | Fase 3: adicionar step ao `ci.yml` antes do primeiro merge em `main` |
| Métricas `auth.login.success/failure` | Prometheus/Pino metrics não implementados | Fase 3: criar módulo `metrics.ts` e expor endpoint `/metrics` |
| Alertas Sentry (brute force) | Rate limit existe no Redis, mas sem hook Sentry | Fase 3: integrar Sentry SDK e adicionar `captureException` no threshold |

### Conformidade com Parte 2

| Seção | Status |
|-------|--------|
| 2.1 Quality Gates | ⚠️ Tipos: ~OK · Lint: ~OK · Testes backend: parcial · Testes frontend: ❌ · E2E: ❌ · Secrets scan: ❌ |
| 2.3 Definition of Done | ⚠️ ~70% — faltam observabilidade e testes frontend |
| 2.6 Padrões PAD-01..08 | ✅ Todos aplicáveis à Auth respeitados |
| 2.9 Observabilidade | ⚠️ `/health` ✅ · Logs Pino ✅ · Métricas de negócio ❌ |

### Próxima fase depende de

- **Schema `users` e `refresh_tokens` existirem no banco** — criados e migrados nesta fase
- **`auth/service.ts` estável** — base para `licensedProcedure` e `superadminProcedure` da Fase 3
- **`ROLE_PERMISSIONS` em `shared`** — importado pelos middlewares de RBAC a criar
- **Tailwind v4 funcional** — base para o design system dos módulos de negócio

---

*Branch entregue: `feature/fase-02-auth` · Merge em `dev` confirmado · Commit final: `defb0f6`*
*Data: 2026-03-21*
