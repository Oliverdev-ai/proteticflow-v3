# Token Map (Brief 07)

## Resultado da auditoria

- `var(--*)` usados em `apps/web/src`: **67**
- Tokens definidos em `apps/web/src/globals.css`: **136**
- Tokens orfaos (usados sem definicao): **0**

## Canonical token set

| Token | Light | Dark | Onde usar | Nao usar |
|---|---|---|---|---|
| `--bg` | `var(--cream-100)` | `var(--ink-900)` | fundo principal da aplicacao | hex direto em layout base |
| `--bg-muted` | `var(--stone-50)` | `var(--ink-600)` | cards secundarios e paines | para destaque de CTA |
| `--bg-subtle` | `var(--cream-200)` | `var(--ink-700)` | hover de linha e fundos suaves | para estado de erro/sucesso |
| `--bg-inverse` | `var(--ink-900)` | `var(--cream-100)` | superfices invertidas (tooltip/dialog dark) | fundo padrao de pagina |
| `--fg` | `var(--stone-900)` | `#ECEEF1` | texto principal | texto de apoio discreto |
| `--fg-muted` | `var(--stone-600)` | `#97A0AB` | texto secundario | placeholder com baixo contraste |
| `--fg-subtle` | `var(--stone-400)` | `#5C6672` | placeholder e metadados | corpo de texto principal |
| `--fg-inverse` | `var(--cream-50)` | `var(--stone-900)` | texto sobre fundo invertido | texto padrao de forms |
| `--fg-disabled` | `var(--stone-400)` | `#5C6672` | campos e labels desabilitados | estados ativos/hover |
| `--border` | `#E5DFD3` | `#232B35` | borda padrao | foco/acento |
| `--border-strong` | `#C8C0B1` | `#303A47` | divisores fortes | borda de input default |
| `--border-focus` | `var(--amber-500)` | `var(--amber-400)` | foco acessivel | borda passiva |
| `--success` | `var(--green-600)` | `#3FB37A` | badge/feedback de sucesso | texto sobre fundo neutro |
| `--success-fg` | `var(--fg-on-primary)` | `#062013` | texto sobre `--success` | texto fora de fundo success |
| `--warning` | `var(--amber-warn)` | `#F0A93B` | aviso e atencao | erro critico |
| `--warning-fg` | `var(--stone-900)` | `#2A1804` | texto sobre `--warning` | texto em superficie neutra |
| `--error` | `var(--destructive)` | `var(--destructive)` | estado de erro | usar cor crua `red-*` |
| `--error-fg` | `var(--fg-on-primary)` | `#2C0907` | texto sobre `--error` | texto geral |
| `--info` | `var(--blue-500)` | `#5E8CFC` | informativos neutros | sucesso/erro |
| `--info-fg` | `var(--fg-on-primary)` | `#08152F` | texto sobre `--info` | texto de leitura longa |
| `--brand` | `var(--primary)` | `var(--primary)` | CTA primario e identidade | substituir sem aprovacao de DS |
| `--brand-hover` | `var(--primary-hover)` | `var(--primary-hover)` | hover de CTA primario | estado normal |
| `--brand-fg` | `var(--fg-on-primary)` | `var(--fg-on-primary)` | texto sobre `--brand` | texto em fundo neutro |
| `--radius-sm` | `6px` | `6px` | inputs/chips | modais |
| `--radius-md` | `10px` | `10px` | botoes/cards | chips pequenos |
| `--radius-lg` | `14px` | `14px` | modais/sheets | itens densos |
| `--shadow-sm` | `0 1px 2px -1px ...` | `0 1px 2px -1px ...` | popovers e cards leves | overlays pesados |
| `--shadow-md` | `0 6px 16px -6px ...` | `0 6px 16px -6px ...` | dropdowns e menus | layout base |
| `--shadow-lg` | `0 24px 48px -12px ...` | `0 24px 48px -12px ...` | modais e drawers | componentes inline |
| `--font-sans` | `Inter` | `Inter` | UI e texto corrente | titulo editorial |
| `--font-serif` | `Instrument Serif` | `Instrument Serif` | titulos premium e hero | corpo de formulario |
| `--font-mono` | `JetBrains Mono` | `JetBrains Mono` | codigo e numerico tabular | texto de leitura |
| `--z-base` | `0` | `0` | fluxo normal da pagina | overlays |
| `--z-raised` | `10` | `10` | cards elevados | modal/dialog |
| `--z-dropdown` | `100` | `100` | dropdowns/menus | toasts |
| `--z-modal` | `200` | `200` | modal/sheet | command palette |
| `--z-palette` | `300` | `300` | command palette | notificacoes globais |
| `--z-toast` | `400` | `400` | toasts e alerts globais | conteudo de pagina |

## Notas

- `--error` canoniza o estado de erro e referencia `--destructive` para compatibilidade.
- O bloco `[data-theme="dark"]` permanece definido em `globals.css` sem ativacao automatica via JS/media query.
