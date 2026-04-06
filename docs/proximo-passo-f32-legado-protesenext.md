# Próximo Passo — F32 + Aproveitamento do Legado Protesenext

Data de consolidação: 2026-04-06

## Decisão de execução

Não iniciar fase nova enquanto a F32 não estiver **formalmente pronta**.

Regra operacional:
- Fase pronta = **testada + push + validação interna + merge em `dev`**.
- Só depois disso abrimos a próxima fase.

## O que o legado agrega (já validado)

O Protesenext não é reaproveitável como código-fonte, mas é valioso como referência funcional e de regras de negócio:
- Ciclo operacional de OS mais rico (exceções como prova/remoldagem/suspensão).
- Financeiro operacional detalhado (extratos, movimentos, rotinas de fechamento).
- Compras/estoque com fluxo de recebimento maduro.
- Relatórios gerenciais avançados (incluindo Curva ABC).

## Gaps concretos no ProteticFlow atual

Com base no código atual:
- Estados de OS estão no fluxo padrão `pending → in_progress → quality_check → ready → delivered (+ cancelled)`.
- Relatórios existem, mas não há Curva ABC implementada.
- Compras e estoque existem, porém sem vínculo explícito de recebimento em contas a pagar.
- Clientes não possuem ainda as regras completas de crédito/bloqueio vistas no legado.

## Próximo passo executável (ordem obrigatória)

1. **Gate F32 (bloqueante)**
- Subir infraestrutura mínima local (Postgres + Redis).
- Garantir migração determinística em banco limpo.
- Rodar validação completa:
```bash
corepack pnpm --filter @proteticflow/shared typecheck
corepack pnpm --filter @proteticflow/server typecheck
corepack pnpm --filter @proteticflow/web typecheck
corepack pnpm --filter @proteticflow/shared lint
corepack pnpm --filter @proteticflow/server lint
corepack pnpm --filter @proteticflow/web lint
corepack pnpm --filter @proteticflow/server test
corepack pnpm --filter @proteticflow/web test
```
- Salvar evidências (comandos + resultado) em `docs/evidencias-f32.md`.

Status em 2026-04-06:
- Typecheck/lint/test executados com sucesso.
- `db:migrate` e `check:tenant-isolation` executados com sucesso.
- Evidências registradas em `docs/evidencias-f32.md`.

Pendência para liberação final:
- Somente fluxo de entrega (`commit`/`push`/validação interna/merge em `dev`).

2. **Bloqueios de validação (já resolvidos em 2026-04-06)**
- `scripts/check-tenant-isolation.ts` foi ajustado para evitar falso positivo em queries encadeadas.
- Conflito de migração (`ENUM` já existente) foi resolvido para suportar bootstrap limpo de ambiente.
- Gate F32 foi reexecutado e aprovado.

3. **Após fechamento formal da F32 (sem iniciar F33): preparar trilha de legado**
- Criar matriz oficial legado → ProteticFlow (coberto, parcial, gap).
- Priorizar backlog de convergência para fase futura:
  - P0: eventos/exceções de OS (remoldagem/suspensão) sem quebrar fluxo atual.
  - P0: integração compras recebidas → contas a pagar.
  - P1: relatório Curva ABC.
  - P1: políticas de crédito/bloqueio de cliente.

## Definition of Done da F32 (para liberar merge)

- Typecheck/lint/test 100% verdes nos pacotes tocados.
- Migração executa em banco limpo sem intervenção manual.
- Sem erro de Redis/Postgres no fluxo normal de backend.
- Evidência registrada em `docs/evidencias-f32.md`.
- Push feito e validação interna concluída.
- Merge em `dev` aprovado.
