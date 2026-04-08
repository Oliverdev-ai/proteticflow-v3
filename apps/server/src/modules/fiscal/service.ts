import { TRPCError } from '@trpc/server';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type {
  Boleto,
  FiscalSettings,
  Nfse,
} from '@proteticflow/shared';
import {
  cancelBoletoSchema,
  cancelNfseSchema,
  emitNfseInBatchSchema,
  emitNfseSchema,
  generateBoletoManualSchema,
  generateBoletoSchema,
  listBoletosSchema,
  listNfseSchema,
  upsertFiscalSettingsSchema,
} from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import {
  boletos,
  fiscalSettings,
  nfseList,
} from '../../db/schema/fiscal.js';
import { accountsReceivable, cashbookEntries, financialClosings } from '../../db/schema/financials.js';
import { clients } from '../../db/schema/clients.js';
import { labSettings, tenants } from '../../db/schema/index.js';
import {
  cancelAsaasBoleto,
  createAsaasBoleto,
  getOrCreateAsaasCustomer,
  parseAsaasWebhookPayment,
  queryAsaasBoleto,
} from './boleto.js';
import { cancelFocusNfse, emitFocusNfse, queryFocusNfse } from './nfse.js';

type GenerateBoletoInput = z.infer<typeof generateBoletoSchema>;
type GenerateBoletoManualInput = z.infer<typeof generateBoletoManualSchema>;
type ListBoletosInput = z.infer<typeof listBoletosSchema>;
type CancelBoletoInput = z.infer<typeof cancelBoletoSchema>;
type EmitNfseInput = z.infer<typeof emitNfseSchema>;
type EmitNfseInBatchInput = z.infer<typeof emitNfseInBatchSchema>;
type ListNfseInput = z.infer<typeof listNfseSchema>;
type CancelNfseInput = z.infer<typeof cancelNfseSchema>;
type UpsertFiscalSettingsInput = z.infer<typeof upsertFiscalSettingsSchema>;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toDigits(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

function toBoletoModel(row: typeof boletos.$inferSelect): Boleto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    arId: row.arId ?? null,
    clientId: row.clientId,
    gatewayId: row.gatewayId ?? null,
    nossoNumero: row.nossoNumero ?? null,
    barcode: row.barcode ?? null,
    pixCopyPaste: row.pixCopyPaste ?? null,
    pdfUrl: row.pdfUrl ?? null,
    status: row.status,
    amountCents: row.amountCents,
    dueDate: row.dueDate.toISOString(),
    paidAt: toIso(row.paidAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function toNfseModel(row: typeof nfseList.$inferSelect): Nfse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId,
    arId: row.arId ?? null,
    closingId: row.closingId ?? null,
    nfseNumber: row.nfseNumber ?? null,
    danfseUrl: row.danfseUrl ?? null,
    status: row.status,
    serviceName: row.serviceName,
    grossValueCents: row.grossValueCents,
    issqnCents: row.issqnCents,
    netValueCents: row.netValueCents,
    tomadorName: row.tomadorName,
    issuedAt: toIso(row.issuedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function toFiscalSettingsModel(row: typeof fiscalSettings.$inferSelect): FiscalSettings {
  return {
    tenantId: row.tenantId,
    municipalRegistration: row.municipalRegistration ?? null,
    taxRegime: row.taxRegime ?? null,
    defaultServiceCode: row.defaultServiceCode ?? null,
    defaultServiceName: row.defaultServiceName ?? null,
    issqnRatePercent: row.issqnRatePercent ? String(row.issqnRatePercent) : null,
    asaasSandbox: row.asaasSandbox === 1,
    focusSandbox: row.focusSandbox === 1,
    cityCode: row.cityCode ?? null,
  };
}

function parsePeriodRange(period: string): { start: Date; end: Date } {
  const [yearRaw = '0', monthRaw = '1'] = period.split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function mapFocusStatus(status: string): 'draft' | 'pending' | 'issued' | 'cancelled' | 'error' {
  const normalized = status.toLowerCase();
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('erro') || normalized.includes('rejeit')) return 'error';
  if (normalized.includes('autoriz') || normalized.includes('emitid') || normalized.includes('aprov')) return 'issued';
  if (normalized.includes('rascunho') || normalized.includes('draft')) return 'draft';
  return 'pending';
}

function mapAsaasStatus(status: string): 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded' {
  const normalized = status.toUpperCase();
  if (normalized === 'RECEIVED' || normalized === 'CONFIRMED' || normalized === 'RECEIVED_IN_CASH') {
    return 'paid';
  }
  if (normalized === 'OVERDUE') return 'overdue';
  if (normalized === 'REFUNDED' || normalized === 'REFUND_REQUESTED') return 'refunded';
  if (normalized === 'DELETED' || normalized === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function parseSandboxFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value.length === 0) return fallback;
  return value !== 'false';
}

async function getFiscalSettingsRow(tenantId: number) {
  const [settings] = await db
    .select()
    .from(fiscalSettings)
    .where(eq(fiscalSettings.tenantId, tenantId));

  return settings ?? null;
}

async function requireFiscalSettings(tenantId: number) {
  const settings = await getFiscalSettingsRow(tenantId);
  if (!settings) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Configuracao fiscal nao definida',
    });
  }
  return settings;
}

async function resolveAsaasConfig(tenantId: number) {
  const settings = await requireFiscalSettings(tenantId);
  const apiKey = settings.asaasApiKey ?? env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Credencial Asaas nao configurada',
    });
  }

  const sandbox = settings.asaasApiKey
    ? settings.asaasSandbox === 1
    : parseSandboxFlag(env.ASAAS_SANDBOX, settings.asaasSandbox === 1);
  return { apiKey, sandbox };
}

async function resolveFocusConfig(tenantId: number) {
  const settings = await requireFiscalSettings(tenantId);
  const token = settings.focusApiToken ?? env.FOCUS_NFE_TOKEN;
  if (!token) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Credencial Focus NFe nao configurada',
    });
  }

  const sandbox = settings.focusApiToken
    ? settings.focusSandbox === 1
    : parseSandboxFlag(env.FOCUS_NFE_SANDBOX, settings.focusSandbox === 1);
  return { token, sandbox, settings };
}

async function getBoletoOrThrow(tenantId: number, boletoId: number) {
  const [row] = await db
    .select()
    .from(boletos)
    .where(and(eq(boletos.tenantId, tenantId), eq(boletos.id, boletoId)));

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Boleto nao encontrado' });
  }

  return row;
}

async function getNfseOrThrow(tenantId: number, nfseId: number) {
  const [row] = await db
    .select()
    .from(nfseList)
    .where(and(eq(nfseList.tenantId, tenantId), eq(nfseList.id, nfseId)));

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'NFS-e nao encontrada' });
  }

  return row;
}

async function markArPaidFromBoletoTx(
  tx: DbTransaction,
  boleto: typeof boletos.$inferSelect,
  paidAt: Date,
  paidAmountCents: number,
): Promise<void> {
  if (!boleto.arId) return;

  const [ar] = await tx
    .select()
    .from(accountsReceivable)
    .where(and(eq(accountsReceivable.tenantId, boleto.tenantId), eq(accountsReceivable.id, boleto.arId)));

  if (!ar || ar.status === 'paid' || ar.status === 'cancelled') return;

  await tx
    .update(accountsReceivable)
    .set({
      status: 'paid',
      paidAt,
      paymentMethod: 'boleto',
      notes: ar.notes ? `${ar.notes}\n[Webhook Asaas]` : '[Webhook Asaas]',
      updatedAt: new Date(),
    })
    .where(eq(accountsReceivable.id, ar.id));

  await tx.insert(cashbookEntries).values({
    tenantId: boleto.tenantId,
    type: 'credit',
    amountCents: paidAmountCents,
    description: `Recebimento boleto AR #${ar.id}`,
    category: 'pagamento_boleto',
    arId: ar.id,
    jobId: ar.jobId,
    clientId: ar.clientId,
    referenceDate: paidAt,
    createdBy: null,
  });
}

export async function generateBoletoFromAr(tenantId: number, input: GenerateBoletoInput, _userId: number): Promise<Boleto> {
  const { apiKey, sandbox } = await resolveAsaasConfig(tenantId);

  const [ar] = await db
    .select()
    .from(accountsReceivable)
    .where(and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.id, input.arId)));

  if (!ar) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta a receber nao encontrada' });
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, ar.clientId)));

  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado para a AR' });
  }

  const payload = {
    arId: ar.id,
    amountCents: ar.amountCents,
    dueDate: ar.dueDate.toISOString(),
    clientId: client.id,
  };

  const [created] = await db
    .insert(boletos)
    .values({
      tenantId,
      arId: ar.id,
      clientId: client.id,
      amountCents: ar.amountCents,
      dueDate: ar.dueDate,
      status: 'pending',
      gatewayPayload: JSON.stringify(payload),
    })
    .returning();

  const customerId = await getOrCreateAsaasCustomer(apiKey, sandbox, {
    name: client.name,
    cpfCnpj: client.document ?? null,
    email: client.email ?? null,
  });

  const asaasResponse = await createAsaasBoleto(apiKey, sandbox, {
    customer: customerId,
    billingType: 'BOLETO',
    value: ar.amountCents / 100,
    dueDate: ar.dueDate.toISOString().slice(0, 10),
    description: ar.description ?? `AR #${ar.id}`,
  });

  const [updated] = await db
    .update(boletos)
    .set({
      gatewayId: asaasResponse.id,
      nossoNumero: asaasResponse.nossoNumero,
      barcode: asaasResponse.barCode,
      pixCopyPaste: asaasResponse.pixQrCodeImage ?? null,
      pdfUrl: asaasResponse.bankSlipUrl,
      gatewayResponse: JSON.stringify(asaasResponse),
      updatedAt: new Date(),
    })
    .where(eq(boletos.id, created!.id))
    .returning();

  logger.info({ action: 'fiscal.boleto.generate_from_ar', tenantId, arId: ar.id, boletoId: updated!.id }, 'Boleto gerado via Asaas');
  return toBoletoModel(updated!);
}

export async function generateBoletoManual(tenantId: number, _userId: number, input: GenerateBoletoManualInput): Promise<Boleto> {
  const { apiKey, sandbox } = await resolveAsaasConfig(tenantId);

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, input.clientId)));

  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado' });
  }

  const dueDate = new Date(input.dueDate);
  const payload = {
    amountCents: input.amountCents,
    dueDate: input.dueDate,
    clientId: client.id,
    description: input.description ?? null,
  };

  const [created] = await db
    .insert(boletos)
    .values({
      tenantId,
      arId: null,
      clientId: client.id,
      amountCents: input.amountCents,
      dueDate,
      status: 'pending',
      gatewayPayload: JSON.stringify(payload),
    })
    .returning();

  const customerId = await getOrCreateAsaasCustomer(apiKey, sandbox, {
    name: client.name,
    cpfCnpj: client.document ?? null,
    email: client.email ?? null,
  });

  const manualPayload: {
    customer: string;
    billingType: 'BOLETO';
    value: number;
    dueDate: string;
    description?: string;
  } = {
    customer: customerId,
    billingType: 'BOLETO',
    value: input.amountCents / 100,
    dueDate: dueDate.toISOString().slice(0, 10),
  };

  if (input.description) {
    manualPayload.description = input.description;
  }

  const asaasResponse = await createAsaasBoleto(apiKey, sandbox, manualPayload);

  const [updated] = await db
    .update(boletos)
    .set({
      gatewayId: asaasResponse.id,
      nossoNumero: asaasResponse.nossoNumero,
      barcode: asaasResponse.barCode,
      pixCopyPaste: asaasResponse.pixQrCodeImage ?? null,
      pdfUrl: asaasResponse.bankSlipUrl,
      gatewayResponse: JSON.stringify(asaasResponse),
      updatedAt: new Date(),
    })
    .where(eq(boletos.id, created!.id))
    .returning();

  logger.info({ action: 'fiscal.boleto.generate_manual', tenantId, boletoId: updated!.id }, 'Boleto manual gerado');
  return toBoletoModel(updated!);
}

export async function listBoletos(tenantId: number, input: ListBoletosInput) {
  const conditions = [eq(boletos.tenantId, tenantId)];

  if (input.status) conditions.push(eq(boletos.status, input.status));
  if (input.clientId) conditions.push(eq(boletos.clientId, input.clientId));
  if (input.dateFrom) conditions.push(sql`${boletos.dueDate} >= ${new Date(input.dateFrom)}`);
  if (input.dateTo) conditions.push(sql`${boletos.dueDate} <= ${new Date(input.dateTo)}`);
  if (input.cursor) conditions.push(lt(boletos.id, input.cursor));

  const rows = await db
    .select()
    .from(boletos)
    .where(and(...conditions))
    .orderBy(desc(boletos.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const data = hasMore ? rows.slice(0, input.limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return {
    data: data.map(toBoletoModel),
    nextCursor,
  };
}

export async function syncBoletoStatus(tenantId: number, boletoId: number): Promise<Boleto> {
  const boleto = await getBoletoOrThrow(tenantId, boletoId);
  if (!boleto.gatewayId) {
    if (boleto.status === 'pending' && boleto.dueDate < new Date()) {
      const [updated] = await db
        .update(boletos)
        .set({
          status: 'overdue',
          updatedAt: new Date(),
        })
        .where(eq(boletos.id, boleto.id))
        .returning();

      return toBoletoModel(updated!);
    }
    return toBoletoModel(boleto);
  }

  const { apiKey, sandbox } = await resolveAsaasConfig(tenantId);
  const gateway = await queryAsaasBoleto(apiKey, sandbox, boleto.gatewayId);
  const mappedStatus = mapAsaasStatus(gateway.status);
  const paidAt = gateway.paidAt ?? boleto.paidAt ?? new Date();
  const paidAmount = gateway.paidValueCents ?? boleto.paidAmountCents ?? boleto.amountCents;

  const [updated] = await db.transaction(async (tx) => {
    const [next] = await tx
      .update(boletos)
      .set({
        status: mappedStatus,
        paidAt: mappedStatus === 'paid' ? paidAt : boleto.paidAt,
        paidAmountCents: mappedStatus === 'paid' ? paidAmount : boleto.paidAmountCents,
        updatedAt: new Date(),
        gatewayResponse: JSON.stringify(gateway),
      })
      .where(eq(boletos.id, boleto.id))
      .returning();

    if (!next) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Boleto nao encontrado' });
    }

    if (mappedStatus === 'paid') {
      await markArPaidFromBoletoTx(tx, next, paidAt, paidAmount);
    }

    return [next];
  });

  return toBoletoModel(updated!);
}

export async function cancelBoleto(tenantId: number, input: CancelBoletoInput, _userId: number): Promise<void> {
  const boleto = await getBoletoOrThrow(tenantId, input.boletoId);

  if (boleto.status === 'paid') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Nao e possivel cancelar boleto ja pago',
    });
  }

  if (boleto.status === 'cancelled') return;

  if (boleto.gatewayId) {
    const { apiKey, sandbox } = await resolveAsaasConfig(tenantId);
    await cancelAsaasBoleto(apiKey, sandbox, boleto.gatewayId);
  }

  await db
    .update(boletos)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
      gatewayResponse: input.reason ? JSON.stringify({ cancelReason: input.reason }) : boleto.gatewayResponse,
    })
    .where(eq(boletos.id, boleto.id));
}

export async function handleAsaasWebhook(rawBody: string): Promise<void> {
  const parsed = parseAsaasWebhookPayment(JSON.parse(rawBody) as unknown);

  const [boleto] = await db
    .select()
    .from(boletos)
    .where(eq(boletos.gatewayId, parsed.gatewayId));

  if (!boleto) return;

  const isPaidSignal = parsed.status === 'RECEIVED' || parsed.status === 'CONFIRMED';
  if (isPaidSignal && boleto.status === 'paid') {
    return;
  }

  await db.transaction(async (tx) => {
    if (isPaidSignal) {
      const paidAt = parsed.paidAt ?? new Date();
      const paidAmount = parsed.paidValueCents ?? boleto.amountCents;

      await tx
        .update(boletos)
        .set({
          status: 'paid',
          paidAt,
          paidAmountCents: paidAmount,
          updatedAt: new Date(),
        })
        .where(eq(boletos.id, boleto.id));

      await markArPaidFromBoletoTx(tx, boleto, paidAt, paidAmount);

      return;
    }

    if (parsed.status === 'OVERDUE') {
      await tx
        .update(boletos)
        .set({ status: 'overdue', updatedAt: new Date() })
        .where(eq(boletos.id, boleto.id));
      return;
    }

    if (parsed.status === 'REFUNDED') {
      await tx
        .update(boletos)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(boletos.id, boleto.id));
    }
  });
}

export async function emitNfse(tenantId: number, _userId: number, input: EmitNfseInput): Promise<Nfse> {
  const { token, sandbox, settings } = await resolveFocusConfig(tenantId);
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });
  }

  if (!settings.municipalRegistration) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Inscricao municipal nao configurada',
    });
  }

  const [lab] = await db
    .select()
    .from(labSettings)
    .where(eq(labSettings.tenantId, tenantId));

  const cnpjPrestador = toDigits(tenant.cnpj ?? lab?.cnpj ?? null);
  if (!cnpjPrestador) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'CNPJ do emissor nao configurado',
    });
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, input.clientId)));

  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado' });
  }

  const serviceCode = input.serviceCode ?? settings.defaultServiceCode;
  if (!serviceCode) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Codigo de servico fiscal nao configurado',
    });
  }

  const serviceName = input.serviceName ?? settings.defaultServiceName ?? 'Servicos laboratoriais';
  const issqnRatePercent = Number(settings.issqnRatePercent ?? '0');
  const issqnCents = Math.round(input.grossValueCents * (issqnRatePercent / 100));
  const netValueCents = input.grossValueCents - issqnCents;

  const payload = {
    cnpj_prestador: cnpjPrestador,
    inscricao_municipal: settings.municipalRegistration,
    data_emissao: new Date().toISOString(),
    tomador: {
      cpf_cnpj: toDigits(client.document ?? null),
      razao_social: client.name,
      email: client.email ?? null,
    },
    servicos: [{
      descricao: serviceName,
      codigo_tributario_municipio: serviceCode,
      valor_servicos: input.grossValueCents / 100,
      aliquota: issqnRatePercent / 100,
    }],
  };

  const [created] = await db
    .insert(nfseList)
    .values({
      tenantId,
      clientId: client.id,
      arId: input.arId ?? null,
      closingId: input.closingId ?? null,
      status: 'pending',
      serviceName,
      serviceCode,
      issqnRatePercent: issqnRatePercent.toFixed(2),
      grossValueCents: input.grossValueCents,
      issqnCents,
      netValueCents,
      tomadorName: client.name,
      tomadorCpfCnpj: toDigits(client.document ?? null),
      tomadorEmail: client.email ?? null,
      gatewayPayload: JSON.stringify(payload),
    })
    .returning();

  try {
    const gateway = await emitFocusNfse(token, sandbox, payload);
    const mappedStatus = mapFocusStatus(gateway.status);

    const [updated] = await db
      .update(nfseList)
      .set({
        gatewayId: gateway.ref,
        status: mappedStatus,
        nfseNumber: gateway.numero ?? null,
        verificationCode: gateway.verificador ?? null,
        danfseUrl: gateway.pdf_url ?? null,
        issuedAt: mappedStatus === 'issued' ? new Date() : null,
        gatewayResponse: JSON.stringify(gateway),
        updatedAt: new Date(),
      })
      .where(eq(nfseList.id, created!.id))
      .returning();

    return toNfseModel(updated!);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao emitir NFS-e';
    const [failed] = await db
      .update(nfseList)
      .set({
        status: 'error',
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(nfseList.id, created!.id))
      .returning();

    return toNfseModel(failed!);
  }
}

export async function emitNfseInBatch(tenantId: number, input: EmitNfseInBatchInput, userId: number): Promise<{ issued: number; errors: number }> {
  const [closing] = await db
    .select()
    .from(financialClosings)
    .where(and(eq(financialClosings.tenantId, tenantId), eq(financialClosings.id, input.closingId)));

  if (!closing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Fechamento nao encontrado' });
  }

  const { start, end } = parsePeriodRange(closing.period);
  const rows = await db
    .select({
      clientId: accountsReceivable.clientId,
      total: sql<number>`sum(${accountsReceivable.amountCents})`,
    })
    .from(accountsReceivable)
    .where(and(
      eq(accountsReceivable.tenantId, tenantId),
      sql`${accountsReceivable.dueDate} >= ${start}`,
      sql`${accountsReceivable.dueDate} <= ${end}`,
      sql`${accountsReceivable.status} != 'cancelled'`,
    ))
    .groupBy(accountsReceivable.clientId);

  let issued = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const nfse = await emitNfse(tenantId, userId, {
        clientId: row.clientId,
        grossValueCents: Number(row.total ?? 0),
        closingId: input.closingId,
      });

      if (nfse.status === 'error') {
        errors += 1;
        continue;
      }

      issued += 1;
    } catch {
      errors += 1;
    }
  }

  return { issued, errors };
}

export async function listNfse(tenantId: number, input: ListNfseInput) {
  const conditions = [eq(nfseList.tenantId, tenantId)];

  if (input.status) conditions.push(eq(nfseList.status, input.status));
  if (input.clientId) conditions.push(eq(nfseList.clientId, input.clientId));
  if (input.dateFrom) conditions.push(sql`${nfseList.createdAt} >= ${new Date(input.dateFrom)}`);
  if (input.dateTo) conditions.push(sql`${nfseList.createdAt} <= ${new Date(input.dateTo)}`);
  if (input.cursor) conditions.push(lt(nfseList.id, input.cursor));

  const rows = await db
    .select()
    .from(nfseList)
    .where(and(...conditions))
    .orderBy(desc(nfseList.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const data = hasMore ? rows.slice(0, input.limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return {
    data: data.map(toNfseModel),
    nextCursor,
  };
}

export async function syncNfseStatus(tenantId: number, nfseId: number): Promise<Nfse> {
  const nfse = await getNfseOrThrow(tenantId, nfseId);
  if (!nfse.gatewayId) return toNfseModel(nfse);

  const { token, sandbox } = await resolveFocusConfig(tenantId);
  const status = await queryFocusNfse(token, sandbox, nfse.gatewayId);
  const mappedStatus = mapFocusStatus(status.status);

  const [updated] = await db
    .update(nfseList)
    .set({
      status: mappedStatus,
      nfseNumber: status.numero ?? nfse.nfseNumber,
      danfseUrl: status.pdf_url ?? nfse.danfseUrl,
      xmlUrl: status.xml_url ?? nfse.xmlUrl,
      issuedAt: mappedStatus === 'issued' && !nfse.issuedAt ? new Date() : nfse.issuedAt,
      gatewayResponse: JSON.stringify(status),
      updatedAt: new Date(),
    })
    .where(eq(nfseList.id, nfse.id))
    .returning();

  return toNfseModel(updated!);
}

export async function cancelNfse(tenantId: number, input: CancelNfseInput, _userId: number): Promise<void> {
  const nfse = await getNfseOrThrow(tenantId, input.nfseId);
  if (nfse.status !== 'issued') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Apenas notas emitidas podem ser canceladas',
    });
  }

  if (!nfse.gatewayId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'NFS-e sem referencia de gateway para cancelamento',
    });
  }

  const { token, sandbox } = await resolveFocusConfig(tenantId);
  await cancelFocusNfse(token, sandbox, nfse.gatewayId, input.reason);

  await db
    .update(nfseList)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: input.reason,
      updatedAt: new Date(),
    })
    .where(eq(nfseList.id, nfse.id));
}

export async function getFiscalSettings(tenantId: number): Promise<FiscalSettings | null> {
  const row = await getFiscalSettingsRow(tenantId);
  return row ? toFiscalSettingsModel(row) : null;
}

export async function upsertFiscalSettings(tenantId: number, _userId: number, input: UpsertFiscalSettingsInput): Promise<FiscalSettings> {
  const [existing] = await db
    .select()
    .from(fiscalSettings)
    .where(eq(fiscalSettings.tenantId, tenantId));

  const updateData: Partial<typeof fiscalSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.municipalRegistration !== undefined) updateData.municipalRegistration = input.municipalRegistration;
  if (input.taxRegime !== undefined) updateData.taxRegime = input.taxRegime;
  if (input.defaultServiceCode !== undefined) updateData.defaultServiceCode = input.defaultServiceCode;
  if (input.defaultServiceName !== undefined) updateData.defaultServiceName = input.defaultServiceName;
  if (input.issqnRatePercent !== undefined) updateData.issqnRatePercent = input.issqnRatePercent;
  if (input.asaasApiKey !== undefined) updateData.asaasApiKey = input.asaasApiKey;
  if (input.asaasSandbox !== undefined) updateData.asaasSandbox = input.asaasSandbox ? 1 : 0;
  if (input.focusApiToken !== undefined) updateData.focusApiToken = input.focusApiToken;
  if (input.focusSandbox !== undefined) updateData.focusSandbox = input.focusSandbox ? 1 : 0;
  if (input.cityCode !== undefined) updateData.cityCode = input.cityCode;

  if (existing) {
    const [updated] = await db
      .update(fiscalSettings)
      .set(updateData)
      .where(eq(fiscalSettings.id, existing.id))
      .returning();

    logger.info({ action: 'fiscal.settings.update', tenantId }, 'Configuracao fiscal atualizada');
    return toFiscalSettingsModel(updated!);
  }

  const insertData: typeof fiscalSettings.$inferInsert = {
    tenantId,
    asaasSandbox: input.asaasSandbox === undefined ? 1 : input.asaasSandbox ? 1 : 0,
    focusSandbox: input.focusSandbox === undefined ? 1 : input.focusSandbox ? 1 : 0,
  };

  if (input.municipalRegistration !== undefined) insertData.municipalRegistration = input.municipalRegistration;
  if (input.taxRegime !== undefined) insertData.taxRegime = input.taxRegime;
  if (input.defaultServiceCode !== undefined) insertData.defaultServiceCode = input.defaultServiceCode;
  if (input.defaultServiceName !== undefined) insertData.defaultServiceName = input.defaultServiceName;
  if (input.issqnRatePercent !== undefined) insertData.issqnRatePercent = input.issqnRatePercent;
  if (input.asaasApiKey !== undefined) insertData.asaasApiKey = input.asaasApiKey;
  if (input.focusApiToken !== undefined) insertData.focusApiToken = input.focusApiToken;
  if (input.cityCode !== undefined) insertData.cityCode = input.cityCode;

  const [created] = await db.insert(fiscalSettings).values(insertData).returning();
  logger.info({ action: 'fiscal.settings.create', tenantId }, 'Configuracao fiscal criada');
  return toFiscalSettingsModel(created!);
}
