# Runbook — Flow IA Incident Response

## Prioridades e SLA
- `P0`: multi-tenant leak suspeito. SLA de mitigação inicial: 15 minutos.
- `P1`: injection spike / abuso. SLA de mitigação inicial: 1 hora.
- `P2`: degradação de provider/custo/TTS sem vazamento. SLA: próximo plantão.

## Fluxo padrão
1. Detecção
2. Diagnóstico
3. Mitigação
4. Resolução
5. Postmortem

## Cenário 1 — Provider LLM caído
Detecção:
- Alerta `AiProviderFailoverSustained`.

Diagnóstico:
- Verifique `/health`.
- Verifique logs `ai.provider.failure` e `ai.provider.failover`.

Mitigação:
- Forçar fallback para provider secundário (config/env).
- Desativar temporariamente features não essenciais de IA.

Resolução:
- Reabilitar provider primário após estabilização.
- Monitorar `ai_latency_ms` e erro por 30 min.

Postmortem:
- Identificar causa raiz (quota, credencial, indisponibilidade externa).
- Registrar tempo total de failover e impacto.

## Cenário 2 — Custo explodindo
Detecção:
- Alerta `AiCostPerTenantExceeded`.

Diagnóstico:
- Consultar `ai_cost_usd_total` por tenant/provider/model.
- Cruzar com `ai_tool_call_total` e `ai_rate_limit_hit_total`.

Mitigação:
- Suspender temporariamente fluxo IA no tenant com abuso.
- Ajustar limite diário do tenant/plano.

Resolução:
- Corrigir bug ou bloquear padrão abusivo.
- Validar retorno gradual com monitoração de 24h.

Postmortem:
- Diferença custo real vs projetado.
- Ação preventiva (alerta/quota/rate limit).

## Cenário 3 — Injection spike
Detecção:
- Alerta `AiInjectionSpike`.

Diagnóstico:
- Verificar logs `ai.injection.attempt` (somente hash/pattern).
- Confirmar origem tenant/user e comando afetado.

Mitigação:
- Bloquear temporariamente o tenant/usuário se comportamento abusivo persistir.
- Aumentar rigor de sanitização se novo vetor for identificado.

Resolução:
- Liberar acesso gradualmente após estabilização.
- Validar queda da série `ai_injection_attempt_total`.

Postmortem:
- Vetor de ataque, superfície explorada e assinatura adicionada.

## Cenário 4 — TTS bill surpresa
Detecção:
- Alerta de billing GCP para TTS.

Diagnóstico:
- Consultar uso em `tts_characters_billed_total`.
- Correlacionar com logs de uso por tenant.

Mitigação:
- Aplicar limite temporário de comprimento de texto para TTS.
- Reduzir uso em tenants de menor prioridade.

Resolução:
- Ajustar política definitiva de TTS por plano.
- Confirmar retorno ao orçamento esperado.

Postmortem:
- Aumentar previsibilidade do custo de voz.

## Cenário 5 — Multi-tenant leak suspeito (P0)
Detecção:
- Relato de cliente vendo dados de outro tenant.

Diagnóstico:
- Auditar trilhas `ai.command.execute` e queries relacionadas ao tenant.
- Validar filtros `tenantId` nos handlers envolvidos.

Mitigação:
- Congelar operações IA afetadas imediatamente.
- Isolar tenant impactado e preservar evidências.

Resolução:
- Corrigir falha de isolamento e validar com teste regressivo.
- Restaurar operação apenas com validação de segurança concluída.

Postmortem:
- Timeline detalhada, impacto, correção permanente e testes adicionados.

## Template curto de postmortem
- Incidente:
- Severidade:
- Detectado em:
- Mitigado em:
- Resolvido em:
- Impacto:
- Causa raiz:
- Correção aplicada:
- Ações preventivas:
