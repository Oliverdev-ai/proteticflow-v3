# DS Guardrails (Brief 06-a)

Este documento registra os guardrails de regressao visual do DS v1.3.0.

## Status atual (06-a)

- Rule custom `ds/guardrails` ativa em `warn` no lint do web.
- Script auxiliar disponivel: `pnpm ds:check`.
- Objetivo da fase 06-a: visibilidade de violações sem bloquear PR.

## Regras monitoradas

Os guardrails cobrem os principais padroes proibidos no DS:

- font-weight fora do limite (`font-black`, `font-extrabold`)
- cores Tailwind cruas fora do token set
- neutros frios (`zinc/slate/gray/neutral`)
- radius acima do limite (`rounded-2xl`, `rounded-3xl`, `rounded-[>14px]`)
- `uppercase` combinado com `tracking-[...]`
- escala agressiva (`active:scale-95`, `hover:scale-1x`)
- sombra colorida
- backdrop blur excessivo
- hex literal em `className`

## Override excepcional

Use apenas quando nao houver alternativa imediata e sempre com motivo:

```tsx
{/* eslint-disable-next-line ds/guardrails -- motivo documentado */} 
<div className="bg-emerald-500">...</div>
```

## Comandos

```bash
pnpm --filter web lint
pnpm ds:check
```
