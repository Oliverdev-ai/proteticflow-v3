# Flow IA - Memoria Persistente, Quiet Mode e LGPD (Fase 7)

## Objetivo
- Persistir memorias de Flow IA com escopo maximo por tenant.
- Exigir plano Pro/Enterprise e opt-in explicito antes de qualquer gravacao persistente.
- Injetar memorias no prompt apenas como fatos, dentro de bloco `<memory>`.
- Atender exportacao e exclusao LGPD com trilha em `lgpd_requests` e audit log.

## Componentes
- Migration: `apps/server/drizzle/0037_phase7_memory_persistent_ga.sql`
- Schema: `apps/server/src/db/schema/ai-memory.ts`
- Service: `apps/server/src/modules/ai/memory.service.ts`
- Embeddings: `apps/server/src/modules/ai/embeddings.provider.ts`
- UI: `/configuracoes/flow-ia/memoria`

## Contrato de Memoria
- Escopos permitidos: `user`, `tenant`.
- Categorias permitidas: `client_preference`, `workflow_rule`, `entity_alias`, `general`.
- TTL default: 180 dias.
- TTL maximo: 365 dias.
- Limite por tenant: 500 entradas, com rotacao FIFO.
- Limite por entrada: 2KB em `value_json`.
- Embedding: pgvector `vector(768)`.
- Provider primario: Gemini `text-embedding-004`.
- Fallback local/teste: embedding deterministico sem dependencia externa.

## Operacao
0. Confirmar que o Postgres tem pgvector instalado:
   - Local/CI usam `pgvector/pgvector:pg16`.
   - Banco gerenciado precisa permitir `CREATE EXTENSION vector`.
1. Aplicar migration:
   - `pnpm --filter server db:migrate`
2. Habilitar por tenant na UI:
   - `/configuracoes/flow-ia/memoria`
   - Botao `Ativar opt-in`
3. Validar:
   - `pnpm --filter server typecheck`
   - `pnpm --filter web typecheck`
   - `pnpm --filter server test -- --runInBand`
   - `pnpm --filter server check:tenant-isolation`

## Quiet Mode
- Comando canonico: `set_quiet_mode`.
- Persistencia: entrada `workflow_rule` com chave `quiet_mode_active`.
- Urgente bypassa quiet mode.
- Alertas nao urgentes sao bloqueados por `apps/server/src/modules/messaging/channel.ts`.

## LGPD
- `ai.lgpd.requestExport` exporta memorias acessiveis do usuario no tenant atual.
- `ai.lgpd.requestDelete` remove memorias do tenant ativo ou vinculadas ao usuario, apaga comandos do usuario e anonimiza dados pessoais.
- `lgpd_requests` e audit log permanecem como trilha.

## Observabilidade
- `ai_memory_total`
- `ai_memory_recall_latency_ms`
- `ai_memory_recall_hit_rate`
- `ai_memory_cap_fifo_evictions_total`
- `ai_memory_forget_total`
- `ai_memory_cleanup_total`

## Checklist de Incidente
- Confirmar tenant e usuario afetados.
- Pausar recall na UI ou via `ai.memory.updateSettings`.
- Exportar evidencias antes de purge quando juridicamente permitido.
- Rodar `ai.lgpd.requestDelete` para direito ao esquecimento.
- Seguir `docs/runbooks/memory-breach.md` se houver vazamento ou acesso indevido.
