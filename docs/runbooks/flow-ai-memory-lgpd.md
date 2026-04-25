# Flow IA - Memoria Persistente, Quiet Mode e LGPD (Fase 7)

## Objetivo
- Persistir memoria contextual por `tenant_id + user_id`.
- Bloquear assistente em horario de quiet mode configurado pelo usuario.
- Atender solicitacoes LGPD de exportacao e exclusao com trilha de auditoria.

## Componentes
- Migration: `apps/server/drizzle/0034_phase7_memory_quiet_lgpd.sql`
- Tabelas:
  - `ai_memory`
  - `lgpd_requests`
- Colunas adicionadas em `user_preferences`:
  - `quiet_mode_enabled`
  - `quiet_mode_start`
  - `quiet_mode_end`

## Endpoints
- `ai.lgpd.requestExport`:
  - cria solicitacao em `lgpd_requests`
  - exporta `ai_memory`, `ai_command_runs` e `alert_log` do usuario
- `ai.lgpd.requestDelete`:
  - cria solicitacao em `lgpd_requests`
  - limpa `ai_memory` do usuario
  - anonimiza `users.email`, `users.phone`, `users.phone_e164`

## Operacao
1. Aplicar migration:
   - `pnpm --filter @proteticflow/server db:migrate`
2. Validar gates:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm --filter @proteticflow/server test`
   - `pnpm --filter @proteticflow/server check:tenant-isolation`

## Observabilidade
- Job de limpeza diario:
  - `cron`: `10 3 * * *`
  - arquivo: `apps/server/src/jobs/cleanup-ai-memory.ts`
- Metricas:
  - `ai_memory_cleanup_total`
