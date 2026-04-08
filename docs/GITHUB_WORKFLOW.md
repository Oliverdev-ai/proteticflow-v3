# ProteticFlow — Fluxo de Trabalho GitHub

## 1. Estratégia de Branches

```
main ←── sempre deployável, produção
  │
  ├── release/v1.0.0 ←── branch de release (freeze para QA final)
  │
  └── dev ←── integração contínua, staging
       │
       ├── feature/fase-01-infraestrutura
       ├── feature/fase-02-auth
       ├── feature/fase-03-multi-tenancy
       │   ...
       ├── feature/fase-28-polimento
       └── fix/descricao-curta
```

| Branch | Merge para | Proteção | Quando usar |
|--------|-----------|----------|-------------|
| `main` | — | PR obrigatório, CI verde, 1 aprovação | Produção. Só recebe de `release/*` ou `fix/*` urgente. |
| `dev` | `release/*` | PR obrigatório, CI verde | Staging. Recebe `feature/*` e `fix/*`. |
| `feature/fase-XX-nome` | `dev` | Não protegida | Uma por fase. Deletada após merge. |
| `release/vX.Y.Z` | `main` + `dev` | Protegida | Freeze para QA. Só aceita fixes. |
| `fix/descricao` | `dev` ou `main` | Não protegida | Correções pontuais. |

### Fluxo típico de uma Fase

```bash
git checkout dev && git pull
git checkout -b feature/fase-04-clientes
# implementar módulo completo — schema, service, router, testes, página, sidebar
git push -u origin feature/fase-04-clientes
# Abrir PR: feature/fase-04-clientes → dev
# CI verde → review → merge → deletar branch
```

## 2. Convenção de Commits

Formato: `tipo(escopo): descrição curta`

| Tipo | Quando usar | Exemplo |
|------|------------|---------|
| `feat` | Nova funcionalidade | `feat(clients): CRUD completo com busca por CEP` |
| `fix` | Correção de bug | `fix(kanban): transição inválida de estado entregue` |
| `refactor` | Refatoração sem mudança de comportamento | `refactor(auth): extrair JWT logic para service` |
| `test` | Adição ou correção de testes | `test(financial): reconciliação AR com fechamento mensal` |
| `docs` | Documentação | `docs: atualizar PRD com módulo fiscal` |
| `chore` | Infraestrutura, CI, dependências | `chore(ci): adicionar tenant isolation check` |
| `style` | Formatação, lint | `style: aplicar prettier em módulo de estoque` |
| `perf` | Otimização de performance | `perf(dashboard): lazy load de gráficos recharts` |

**Regras:**
- Primeira linha: máximo 72 caracteres
- Escopo = módulo do PRD
- Descrição em português
- `closes #123` no corpo se resolve issue

## 3. Versionamento Semântico

| Tag | Bloco | Fases | Marco |
|-----|-------|-------|-------|
| v0.1.0 | Fundação | 1-3 | Semana 3 |
| v0.2.0 | Core CRUD | 4-7 | Semana 7 |
| v0.3.0 | Operações | 8-14 | Semana 14 |
| v0.4.0 | Plataforma | 15-19 | Semana 18 |
| v0.5.0 | Inteligência | 20-22 | Semana 22 |
| v0.6.0 | Comercialização | 23-25 | Semana 27 |
| v1.0.0 | GO LIVE | 26-28 | Semana 31 |
| v1.1.0 | WhatsApp | 29 | Pós-lançamento |
| v1.2.0 | Multi-Empresa | 30 | Pós-lançamento |

## 4. Labels

### Por Bloco
| Label | Cor | Fases |
|-------|-----|-------|
| `bloco:A-fundação` | #0E8A16 | 1-3: Infra, Auth, Tenant |
| `bloco:B-core` | #1D76DB | 4-7: Clientes, Preços, OS, Kanban |
| `bloco:C-operações` | #5319E7 | 8-14: Financeiro, Estoque, RH |
| `bloco:D-plataforma` | #F9D0C4 | 15-19: Portal, Notificações, Relatórios |
| `bloco:E-inteligência` | #D93F0B | 20-22: IA Flow, Suporte, IA Avançada |
| `bloco:F-comercial` | #FBCA04 | 23-25: Licenciamento, Boletos, NFS-e |
| `bloco:G-finalização` | #B60205 | 26-28: Dashboard, Auditoria, Polimento |
| `bloco:H-expansão` | #C2E0C6 | 29-30: WhatsApp, Filiais |

### Por Tipo
`tipo:feature` · `tipo:bug` · `tipo:infra` · `tipo:docs` · `tipo:refactor` · `tipo:security`

### Por Prioridade
`prioridade:crítica` · `prioridade:alta` · `prioridade:média` · `prioridade:baixa`

### Por Status
`status:em-progresso` · `status:review` · `status:bloqueado`

## 5. Proteção de Branches

### `main`
- PR obrigatório + 1 aprovação
- Dismiss stale approvals when new commits pushed
- Status checks obrigatórios: `lint-and-typecheck`, `test`, `build`, `tenant-isolation-check`
- Branches up to date before merging
- Sem force push. Sem delete.

### `dev`
- PR obrigatório (0 aprovações — agentes IA podem auto-merge se CI verde)
- Mesmos status checks
- Linear history (rebase, não merge commits)
- Sem force push.
