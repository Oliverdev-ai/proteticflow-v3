# Tenant Isolation Audit (Brief 09)

Data da auditoria: 2026-05-27

## Resultado: APROVADO (0 falhas criticas)

Resumo executivo:
- `protectedProcedure` aparece apenas em `auth` e `tenants` (onboarding/sessao), sem uso em modulos de negocio.
- Routers de negocio auditados usam `tenantProcedure`/`licensedProcedure`/`adminProcedure` ou especializacoes (`financialProcedure`, `reportsProcedure`, `aiProcedure`).
- Nao foram encontradas queries diretas sem escopo de tenant nos routers de negocio.
- Em financeiro, fluxos multi-escrita criticos (`markArPaid`, `markApPaid`) usam `db.transaction()`.
- Bloqueantes de concorrencia em `payroll.closePeriod`, `purchases.confirmPurchase` e `purchases.cancelPurchase` corrigidos com atomicidade/lock otimista.

### Procedures auditadas
| Router | Procedure | Status |
|---|---|---|
| `auth` | `publicProcedure`, `protectedProcedure`, `adminProcedure` | OK (dominio de autenticacao/perfil) |
| `tenant` | `protectedProcedure`, `tenantProcedure`, `adminProcedure` | OK (onboarding/switch + gestao tenant) |
| `clientes` | `licensedProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `job` | `licensedProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `employees` | `licensedProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `inventory` | `licensedProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `agenda` | `tenantProcedure` | OK |
| `delivery` | `tenantProcedure` | OK |
| `purchases` | `tenantProcedure` | OK |
| `financial` | `financialProcedure`, `financialAdminProcedure`, `tenantProcedure` | OK |
| `payroll` | `financialProcedure` | OK |
| `reports` | `reportsProcedure`, `reportsAdminProcedure` | OK |
| `dashboard` | `tenantProcedure` | OK |
| `pricing` | `licensedProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `scans` | `licensedProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `simulator` | `licensedProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `notifications` | `tenantProcedure`, `adminProcedure` | OK |
| `portal` | `publicProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `support` | `publicProcedure`, `tenantProcedure`, `adminProcedure` | OK |
| `fiscal` | `tenantProcedure`, `adminProcedure` | OK |
| `licensing` | `tenantProcedure`, `superadminProcedure` | OK |
| `audit` | `tenantProcedure`, `adminProcedure`, `superadminProcedure` | OK |
| `settings` | `tenantProcedure`, `adminProcedure` | OK |
| `ai` | `aiProcedure`, `aiFullProcedure`, `voiceProcedure`, `tenantProcedure` | OK |

### Falhas encontradas (se houver)
| Router | Procedure incorreta | Correcao aplicada |
|---|---|---|
| Nenhuma | - | - |

### Queries sem tenantId filter
| Arquivo | Linha | Decisao |
|---|---|---|
| `apps/server/src/modules/tenants/router.ts` | 47 | Query direta em router validada: `.where(eq(tenants.id, ctx.tenantId!))` |
| Routers de negocio (`clients/jobs/employees/inventory/agenda/purchases/deliveries/...`) | - | Sem query direta detectada no router; isolamento delegado aos services via `ctx.tenantId` |

## Evidencias usadas
- Inventario de procedures em `apps/server/src/modules/**/*router*.ts`.
- Busca de uso de `protectedProcedure` em modulos de negocio.
- Busca de query direta em routers (`db.select/insert/update/delete/transaction`).
- Verificacao de transacao financeira em `apps/server/src/modules/financial/service.ts` (`markArPaid` e `markApPaid`).

## Derivação de procedures (chain de herança verificada)

| Procedure | Herda de | tenantId injetado? |
|---|---|---|
| `licensedProcedure` | `tenantProcedure` | ✅ Sim |
| `financialProcedure` | `tenantProcedure` | ✅ Sim |
| `reportsProcedure` | `tenantProcedure` | ✅ Sim |
| `adminProcedure` | `tenantProcedure` | ✅ Sim |
| `aiProcedure` / `aiFullProcedure` | `tenantProcedure` | ✅ Sim |

## Cobertura de db.transaction() — ops de escrita financeiras

| Service | Função | Usa transaction? |
|---|---|---|
| payroll | `generateEntries` | ✅ |
| payroll | `updateEntry` | ✅ |
| payroll | `closePeriod` | ✅ (corrigido neste PR) |
| payroll | `reopenPeriod` | ✅ |
| purchases | `createPurchase` | ✅ |
| purchases | `receivePurchase` | ✅ |
| purchases | `confirmPurchase` | ✅ lock otimista (corrigido neste PR) |
| purchases | `cancelPurchase` | ✅ lock otimista (corrigido neste PR) |

## Falha corrigida — enforceLicense

`enforceLicense` era no-op. Corrigido para invocar `checkFeatureAccess(ctx.tenantId, 'financial')`.

## Resultado atualizado

| Item | Status anterior | Status real |
|---|---|---|
| Tenant isolation (procedure chain) | ✅ OK | ✅ OK — `licensedProcedure` estende `tenantProcedure` |
| `closePeriod` atomicidade | não auditado | ✅ Corrigido |
| `cancelPurchase` race condition | não auditado | ✅ Corrigido |
| `confirmPurchase` atomicidade | não auditado | ✅ Corrigido |
| `enforceLicense` implementação | não auditado | ✅ Corrigido |
