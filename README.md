# ProteticFlow v3

Sistema SaaS de gestão para laboratórios de prótese dentária com IA integrada.

> **Fonte da verdade:** [`docs/ProteticFlow_v3_DEFINITIVO.md`](./docs/ProteticFlow_v3_DEFINITIVO.md) — 289 requisitos, 27 módulos, 28 fases. Nenhum requisito existe fora deste documento.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js 22 LTS |
| Linguagem | TypeScript 5.x (strict) |
| Backend | Express + tRPC v11 |
| Frontend | React 19 + Vite 7 |
| ORM | Drizzle (PostgreSQL 16) |
| UI | shadcn/ui + Tailwind CSS 4 |
| Testes | Vitest + Playwright |
| Monorepo | Turborepo + pnpm |
| Deploy | Docker Compose → Railway/Render |
| CI/CD | GitHub Actions |

## Estrutura

```
proteticflow-v3/
├── apps/
│   ├── web/          # Frontend React + Vite
│   └── server/       # Backend Express + tRPC
├── packages/
│   └── shared/       # Tipos Zod, constantes, utils compartilhados
├── docker/           # Docker Compose (dev/staging/prod)
└── docs/             # PRD, ADRs, guias
```

## Desenvolvimento

```bash
# Pré-requisitos: Node.js 22+, pnpm 9+, Docker

git clone git@github.com:Oliverdev-ai/proteticflow-v3.git
cd proteticflow-v3
pnpm install
docker compose -f docker/docker-compose.yml up -d
pnpm --filter server db:push
pnpm dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3000
```

## Princípios Inegociáveis (PRD v3.3)

1. **TypeScript strict ponta a ponta.** Zero `.js`. Zero `any`.
2. **Multi-tenancy real.** Toda query filtrada por `tenantId`. CI quebra se esquecer.
3. **Módulo completo ou inexistente.** Schema → Service → Router → Testes → Página → Sidebar.
4. **Segurança por padrão.** RBAC em toda rota. Audit log em toda escrita.
5. **Qualidade contínua.** CI bloqueia merge se testes falham ou cobertura cai.

## Referência Legada

[`Oliverdev-ai/proteticflow`](https://github.com/Oliverdev-ai/proteticflow) — código anterior (Django + proteticflow-ui). Serve como **referência funcional** — os 56 models Django (1561 campos) como piso de completude de dados.

## Licença

Proprietário. Todos os direitos reservados.