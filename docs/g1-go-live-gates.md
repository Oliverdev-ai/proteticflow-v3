# G1 - Go-Live Gates (merge requirement)

Este documento define os gates automatizados que passam a ser requisito para merge nas proximas fases de Go-Live.

## Comandos locais

```bash
pnpm g1:go-live
pnpm --filter @proteticflow/web build
pnpm g1:go-live:bundle
```

## O que o gate valida

- Zero `any` em `apps/` e `packages/`.
- Zero `@ts-ignore` e `@ts-nocheck`.
- Zero `it.skip`/`test.skip`/`xit`/`xdescribe`, exceto skips condicionais de E2E por variavel de ambiente.
- Zero `violet`, `indigo` e `neutral-*` em `apps/web/src`.
- Zero `protectedProcedure` em modulos tenant (excecoes explicitas: `auth/router.ts` e `tenants/router.ts`).
- Bundle web sem chunk acima de 500KB (com base em `apps/web/dist/bundle-report.json`).

## CI

O workflow de CI executa:

1. `pnpm g1:go-live` no job `lint-and-typecheck`.
2. `pnpm g1:go-live:bundle` no job `build` (apos `pnpm build`).

## Gates manuais ainda necessarios

- Lighthouse (Performance, Accessibility, Best Practices, SEO >= 90).
- Smoke test funcional em ambiente alvo.
- Backup/restore e subida do compose de producao.
