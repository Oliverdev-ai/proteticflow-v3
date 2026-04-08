# Evidências de Validação — F32

Data: 2026-04-06

## Resultado geral

Status atual da validação técnica da F32: **verde** (typecheck, lint e testes).

## Comandos executados

```bash
corepack pnpm --filter @proteticflow/shared typecheck
# ✅ pass

corepack pnpm --filter @proteticflow/server typecheck
# ✅ pass

corepack pnpm --filter @proteticflow/web typecheck
# ✅ pass

corepack pnpm --filter @proteticflow/shared lint
# ✅ pass

corepack pnpm --filter @proteticflow/server lint
# ✅ pass

corepack pnpm --filter @proteticflow/web lint
# ✅ pass

corepack pnpm --filter @proteticflow/server test
# ✅ pass — 33 arquivos de teste, 330 testes aprovados

corepack pnpm --filter @proteticflow/web test
# ✅ pass — 18 arquivos de teste, 18 testes aprovados

corepack pnpm --filter @proteticflow/server check:tenant-isolation
# ✅ pass — auditoria finalizou com PASS

corepack pnpm --filter @proteticflow/server db:migrate
# ✅ pass — migrations applied successfully
```

## Verificações adicionais de protocolo

```bash
git grep -n -E ": any| as any" -- apps packages
# ✅ 0 ocorrências

Select-String "from '@/" em apps/web/src
# ✅ 0 ocorrências

Select-String "violet|indigo" em apps/web/src (.tsx/.css)
# ✅ 0 ocorrências
```

## Observações do ambiente de execução

- No sandbox padrão houve erro `spawn EPERM` ao iniciar Vitest (esbuild/Vite).
- No sandbox padrão também ocorreu `spawn EPERM` em `db:migrate`.
- A execução sem restrição de sandbox permitiu rodar os testes normalmente.
- A execução sem restrição de sandbox permitiu executar a migração normalmente.
- Não houve falha funcional de suíte nem de migração após esse ajuste de ambiente.
