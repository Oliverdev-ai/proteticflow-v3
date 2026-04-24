# Runbook — Flow Proactive Motor (Fase 5)

## Objetivo
Operar e diagnosticar o motor proativo do Flow IA (BullMQ + alertas contextuais + briefing diário).

## Componentes
- Fila `flow-briefing`: varredura horária para briefing diário.
- Fila `flow-alerts`: varreduras de `deadline_24h`, `deadline_overdue`, `stock_low`, `payment_overdue`.
- Fila `flow-messages`: roteamento por canal (`in_app`, `push`, `email`, `whatsapp` mock F5).
- Tabelas: `alert_log` (dedup/auditoria), `user_preferences` (quiet hours + canais + mute).

## Variáveis obrigatórias
- `REDIS_URL`
- `BULLMQ_CONCURRENCY` (default `10`)
- `BULLMQ_STALLED_INTERVAL` (default `30000`)
- `WHATSAPP_PROVIDER` (`mock` na F5; em produção não pode ser `mock`)

## Sinais de saúde
- `flow_queue_depth{queue}`
- `flow_queue_job_duration_ms_bucket{queue,job_type}`
- `flow_queue_stalled_total{queue}`
- `flow_channel_send_total{channel,status}`
- `flow_briefing_sent_total{tenant_id,status}`
- `flow_alert_triggered_total{tenant_id,alert_type,dedup_hit}`

## Operação diária
1. Verifique `/health` e `/metrics`.
2. Confirme backlog baixo em `flow_queue_depth`.
3. Verifique falha por canal (`flow_channel_send_total{status="failed"}`).
4. Verifique `dedup_hit=true` em volume esperado (não zero absoluto, não explosão).

## Diagnóstico rápido

### 1) Backlog alto
- Alerta: `FlowQueueBacklog`.
- Ação:
  - Verificar Redis.
  - Verificar workers ativos e logs `jobs_queue.workers.started`.
  - Reduzir carga temporária (pausar schedulers) ou subir capacidade.

### 2) Falha de canal > 10%
- Alerta: `FlowChannelFailureRateHigh`.
- Ação:
  - Confirmar configuração SMTP/VAPID.
  - Verificar fallback de canal (push -> in_app/email).
  - Se for WhatsApp na F5, lembrar que é mock (sem envio real).

### 3) Briefing skipped alto
- Alerta: `FlowBriefingSkippedHigh`.
- Ação:
  - Verificar `user_preferences` (briefingEnabled, briefingTime, quiet hours).
  - Verificar dedup excessivo (`alert_log_dedup_uniq`).
  - Verificar erros LLM (fallback estático deve manter envio).

## Segurança e isolamento
- Worker sempre constrói contexto por `tenantId` do job.
- Dedup race: `alert_log_dedup_uniq` é fonte de verdade.
- Payload de `alert_log` deve carregar IDs, não PII.

## Rollback
1. Desativar registro de schedulers do motor proativo.
2. Manter cron legados ativos.
3. Preservar tabelas `alert_log` e `user_preferences` (sem drop).
