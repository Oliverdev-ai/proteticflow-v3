# ProteticFlow v3 - Runbook de Operacao

## 1. Requisitos
- Node.js 22 LTS
- pnpm 9 (via Corepack)
- Docker + Docker Compose
- PostgreSQL 16
- Redis 7

## 2. Setup Local (desenvolvimento)
```bash
git clone https://github.com/Oliverdev-ai/proteticflow-v3.git
cd proteticflow-v3

corepack enable
corepack prepare pnpm@9 --activate
pnpm install

docker compose -f docker/docker-compose.dev.yml up -d

cp .env.example .env
# Ajuste as variaveis no .env

pnpm --filter @proteticflow/server db:push
pnpm --filter @proteticflow/server db:seed

pnpm dev
# Server: http://localhost:3001
# Web: http://localhost:5173
```

## 3. Deploy (producao)
```bash
# Opcao recomendada
./scripts/deploy.sh

# Opcao manual
docker compose -f docker/docker-compose.prod.yml up -d --build
```

## 4. Backup e Restore
```bash
./scripts/backup.sh
./scripts/restore.sh proteticflow_backup_YYYYMMDD_HHMMSS.sql.gz
```

## 5. Health check
- Endpoint: `GET /health`
- Resposta esperada: `status: ok` ou `status: degraded` com detalhes de `database` e `redis`.

## 6. Migrations e Seed
```bash
pnpm --filter @proteticflow/server db:generate
pnpm --filter @proteticflow/server db:push
pnpm --filter @proteticflow/server db:seed
```

## 7. Monitoramento
- Logs estruturados: `pino` + correlation id por request
- Erros de aplicacao: Sentry (`SENTRY_DSN`)
- Disponibilidade: `/health` para probes do balanceador

## 8. Variaveis de ambiente
Consulte `.env.example`.

Obrigatorias:
- `DATABASE_URL`
- `JWT_SECRET`
- `SETTINGS_SECRET_KEY`

Opcionais por modulo:
- `ANTHROPIC_API_KEY` (IA)
- `STRIPE_SECRET_KEY` (licenciamento)
- `ASAAS_API_KEY` (boletos)
- `FOCUS_NFE_TOKEN` (NFS-e)
- `SENTRY_DSN` (observabilidade)
- `SMTP_*` (email)
- `VAPID_*` (push)
- `BACKUP_S3_BUCKET` (backup)

## 9. Troubleshooting

### Server nao inicia
1. Validar `DATABASE_URL`.
2. Confirmar containers com `docker ps`.
3. Reaplicar schema com `pnpm --filter @proteticflow/server db:push`.

### Erro de build/typecheck
1. `pnpm typecheck`
2. `pnpm lint`
3. Reinstalar deps: `pnpm install`

### Rate limiting
- Dev: limite relaxado.
- Producao: global 200 req/min e auth 10 tentativas/15 min.

### Email nao envia
1. Validar variaveis `SMTP_*`.
2. Verificar logs por `email.error`.
3. Revisar fallback de envio.

## 10. Arquitetura resumida
- Monorepo: `apps/web`, `apps/server`, `packages/shared`
- API: tRPC v11
- Auth: JWT + refresh token em cookie httpOnly
- RBAC: superadmin, gerente, producao, recepcao, contabil
- Multi-tenant: isolamento por `tenantId`
- Licenciamento: trial, starter, pro, enterprise
