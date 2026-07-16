# Runbook - Incidente de Memoria Flow IA

## Quando usar
- Memoria gravada no tenant errado.
- Dado pessoal sensivel persistido indevidamente.
- Suspeita de vazamento, prompt injection persistente ou acesso indevido.
- Recall exibindo fatos de outro usuario ou tenant.

## Contencao imediata
1. Pausar recall do tenant afetado em `/configuracoes/flow-ia/memoria`.
2. Bloquear novos writes se o incidente envolver prompt poisoning ou integridade de dados.
3. Preservar logs de `audit_logs`, `lgpd_requests`, `ai_command_runs` e metricas Prometheus.
4. Nao rodar scripts diretos no banco antes de coletar evidencias minimas.

## Investigacao
- Identificar `tenant_id`, `user_id`, `ai_memory.id`, `category`, `scope` e `source`.
- Verificar se a entrada veio de `remember_fact`, UI manual ou quiet mode.
- Confirmar se houve cross-tenant usando filtros por `tenant_id`.
- Revisar `value_json` e `key_text` para instrucoes maliciosas persistidas.

## Remediacao
- Para exclusao pontual: usar `ai.memory.forget`.
- Para purge do usuario/tenant: usar `ai.memory.forgetAll` ou `ai.lgpd.requestDelete`.
- Se houve poisoning, renovar embeddings somente apos remover entradas comprometidas.
- Reabilitar recall apenas depois de validar listagem e recall no tenant afetado.

## Comunicacao e LGPD
- Classificar impacto: dado pessoal, dado sensivel, segredo operacional ou falso positivo.
- Se houver risco relevante a titulares, preparar notificacao ANPD e titulares em ate 72h.
- Registrar linha do tempo, causa raiz, escopo, medidas de contencao e plano preventivo.

## Pos-incidente
- Adicionar teste regressivo para isolamento, sanitizacao ou LGPD conforme o caso.
- Conferir metricas `ai_memory_forget_total`, `ai_memory_recall_hit_rate` e auditoria de writes.
- Atualizar este runbook se o procedimento real divergir.
