# Runbook — AI Billing Setup (GCP + Anthropic)

## Objetivo
Configurar guardrails de custo para operação de Flow IA em produção.

## Escopo
- Alertas de billing no GCP para consumo de TTS/Gemini.
- Cotas iniciais de Gemini.
- Cap de uso mensal em Anthropic.
- Verificação de roteamento para canal `#ai-ops`.

## Pré-requisitos
- Acesso administrativo ao projeto GCP de produção.
- Acesso administrativo ao workspace Anthropic da operação.
- Canal Slack `#ai-ops` com integração ativa.

## Passo 1 — Alertas no GCP Billing
1. Abra `Billing > Budgets & alerts`.
2. Crie um budget com escopo do projeto de IA (`ProteticFlow-AI`).
3. Configure thresholds:
- `50 USD` (warning)
- `100 USD` (warning)
- `200 USD` (critical)
4. Habilite notificação por e-mail para o grupo de Ops e webhook/integração para Slack.

## Passo 2 — Quota Gemini
1. Abra `Google AI Studio` ou painel de quota da API Gemini usada em produção.
2. Defina quota inicial:
- `5.000.000 tokens/dia`
3. Registre responsável e data de revisão da quota.

## Passo 3 — Usage cap Anthropic
1. Abra painel de billing Anthropic.
2. Defina spending cap mensal:
- `100 USD/mês`
3. Habilite alertas de aproximação de limite (>= 80% e >= 95%).

## Passo 4 — Verificação operacional
1. Confirme que alertas chegam ao `#ai-ops`.
2. Confirme que rota de escalonamento crítica está documentada no runbook de incidentes.
3. Execute smoke manual de custo:
- Gere tráfego controlado em staging.
- Valide incremento em `ai_cost_usd_total`.

## Checklist de aceite
- [ ] Budget GCP criado com 3 thresholds
- [ ] Quota Gemini aplicada (5M/dia)
- [ ] Cap Anthropic aplicado (100/mês)
- [ ] Alertas chegando no `#ai-ops`
- [ ] Responsável de revisão trimestral definido
