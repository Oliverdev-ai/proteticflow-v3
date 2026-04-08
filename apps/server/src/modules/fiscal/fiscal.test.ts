import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { osBlocks, users, tenants, tenantMembers } from '../../db/schema/index.js';
import { clients } from '../../db/schema/clients.js';
import { accountsReceivable, cashbookEntries, financialClosings } from '../../db/schema/financials.js';
import { boletos, fiscalSettings, nfseList } from '../../db/schema/fiscal.js';
import { hashPassword } from '../../core/auth.js';
import * as fiscalService from './service.js';
import {
  cancelAsaasBoleto,
  createAsaasBoleto,
  getOrCreateAsaasCustomer,
  parseAsaasWebhookPayment,
  queryAsaasBoleto,
} from './boleto.js';
import { cancelFocusNfse, emitFocusNfse } from './nfse.js';

vi.mock('./boleto.js', () => ({
  cancelAsaasBoleto: vi.fn(async () => undefined),
  createAsaasBoleto: vi.fn(async () => ({
    id: 'pay_mock',
    nossoNumero: 'nosso_1',
    barCode: '1234567890',
    bankSlipUrl: 'https://sandbox.asaas.com/boleto/1',
  })),
  getOrCreateAsaasCustomer: vi.fn(async () => 'cus_mock'),
  parseAsaasWebhookPayment: vi.fn(),
  queryAsaasBoleto: vi.fn(async () => ({
    status: 'PENDING',
    paidAt: null,
    paidValueCents: null,
  })),
}));

vi.mock('./nfse.js', () => ({
  cancelFocusNfse: vi.fn(async () => undefined),
  emitFocusNfse: vi.fn(async () => ({ ref: 'nfse_mock_ref', status: 'PROCESSANDO' })),
  queryFocusNfse: vi.fn(async () => ({ status: 'PROCESSANDO' })),
}));

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function createTestUser(email: string) {
  const [user] = await db.insert(users).values({
    name: 'Fiscal Test',
    email,
    passwordHash: await hashPassword('Test123!'),
    role: 'user',
  }).returning();

  if (!user) throw new Error('Failed to create user');
  return user;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, {
    name,
    cnpj: String(10_000_000_000_000 + Math.floor(Math.random() * 9_000_000_000_000)),
  });
}

async function createTestClient(tenantId: number, userId: number, name = 'Cliente Fiscal') {
  const { createClient } = await import('../clients/service.js');
  return createClient(tenantId, {
    name,
    priceAdjustmentPercent: 0,
    email: `${uid('cliente')}@example.com`,
    documentType: 'cnpj',
    document: String(10_000_000_000_000 + Math.floor(Math.random() * 9_000_000_000_000)),
  }, userId);
}

async function createAr(tenantId: number, clientId: number, amountCents = 12_000, dueDate = new Date()) {
  const [ar] = await db.insert(accountsReceivable).values({
    tenantId,
    jobId: Math.floor(Math.random() * 10_000) + 1,
    clientId,
    amountCents,
    dueDate,
    status: 'pending',
  }).returning();

  if (!ar) throw new Error('Failed to create AR');
  return ar;
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(cashbookEntries);
  await db.delete(boletos);
  await db.delete(nfseList);
  await db.delete(fiscalSettings);
  await db.delete(financialClosings);
  await db.delete(accountsReceivable);
  await db.delete(osBlocks);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('fiscal service', () => {
  beforeEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('T01: generateBoletoFromAr sem fiscal settings deve falhar', async () => {
    const user = await createTestUser(`${uid('fiscal-t01')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T01');
    const client = await createTestClient(tenant.id, user.id);
    const ar = await createAr(tenant.id, client.id);

    await expect(fiscalService.generateBoletoFromAr(tenant.id, { arId: ar.id }, user.id)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('T02: generateBoletoFromAr com settings cria boleto pending', async () => {
    const user = await createTestUser(`${uid('fiscal-t02')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T02');
    const client = await createTestClient(tenant.id, user.id);
    const ar = await createAr(tenant.id, client.id, 25_000);

    await fiscalService.upsertFiscalSettings(tenant.id, user.id, {
      asaasApiKey: 'asaas_tenant_key',
      asaasSandbox: true,
    });

    vi.mocked(getOrCreateAsaasCustomer).mockResolvedValueOnce('cus_123');
    vi.mocked(createAsaasBoleto).mockResolvedValueOnce({
      id: 'pay_123',
      nossoNumero: 'nosso_123',
      barCode: '237938938938',
      pixQrCodeImage: 'pix-copy-paste',
      bankSlipUrl: 'https://sandbox.asaas.com/boleto/123',
    });

    const created = await fiscalService.generateBoletoFromAr(tenant.id, { arId: ar.id }, user.id);

    expect(created.status).toBe('pending');
    expect(created.gatewayId).toBe('pay_123');
    expect(created.amountCents).toBe(25_000);
  });

  it('T03: cancelBoleto pago deve falhar', async () => {
    const user = await createTestUser(`${uid('fiscal-t03')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T03');
    const client = await createTestClient(tenant.id, user.id);

    const [boleto] = await db.insert(boletos).values({
      tenantId: tenant.id,
      clientId: client.id,
      amountCents: 10_000,
      dueDate: new Date(),
      status: 'paid',
      gatewayId: 'pay_cancel_check',
    }).returning();

    await expect(fiscalService.cancelBoleto(tenant.id, { boletoId: boleto!.id }, user.id)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    expect(cancelAsaasBoleto).not.toHaveBeenCalled();
  });

  it('T04/T05: handleAsaasWebhook atualiza boleto/AR e e idempotente', async () => {
    const user = await createTestUser(`${uid('fiscal-t04')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T04');
    const client = await createTestClient(tenant.id, user.id);
    const ar = await createAr(tenant.id, client.id, 18_000);

    const [boleto] = await db.insert(boletos).values({
      tenantId: tenant.id,
      arId: ar.id,
      clientId: client.id,
      gatewayId: 'pay_webhook_1',
      amountCents: 18_000,
      dueDate: new Date(),
      status: 'pending',
    }).returning();

    vi.mocked(parseAsaasWebhookPayment).mockReturnValue({
      gatewayId: 'pay_webhook_1',
      status: 'CONFIRMED',
      paidAt: new Date('2026-03-01T10:00:00.000Z'),
      paidValueCents: 18_000,
    });

    await fiscalService.handleAsaasWebhook('{"event":"PAYMENT_CONFIRMED"}');
    await fiscalService.handleAsaasWebhook('{"event":"PAYMENT_CONFIRMED"}');

    const [updatedBoleto] = await db.select().from(boletos).where(eq(boletos.id, boleto!.id));
    const [updatedAr] = await db.select().from(accountsReceivable).where(eq(accountsReceivable.id, ar.id));
    const cashbook = await db.select().from(cashbookEntries).where(eq(cashbookEntries.arId, ar.id));

    expect(updatedBoleto?.status).toBe('paid');
    expect(updatedAr?.status).toBe('paid');
    expect(cashbook).toHaveLength(1);
  });

  it('T06: emitNfse sem inscricao municipal deve falhar', async () => {
    const user = await createTestUser(`${uid('fiscal-t06')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T06');
    const client = await createTestClient(tenant.id, user.id);

    await fiscalService.upsertFiscalSettings(tenant.id, user.id, {
      focusApiToken: 'focus_token',
      focusSandbox: true,
      defaultServiceCode: '1401',
    });

    await expect(fiscalService.emitNfse(tenant.id, user.id, {
      clientId: client.id,
      grossValueCents: 50_000,
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(emitFocusNfse).not.toHaveBeenCalled();
  });

  it('T07/T13: emitNfse em sandbox cria registro com snapshot', async () => {
    const user = await createTestUser(`${uid('fiscal-t07')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T07');
    const client = await createTestClient(tenant.id, user.id, 'Clinica Snapshot');

    await fiscalService.upsertFiscalSettings(tenant.id, user.id, {
      municipalRegistration: '12345',
      focusApiToken: 'focus_token',
      focusSandbox: true,
      defaultServiceCode: '1401',
      defaultServiceName: 'Servico padrao',
      issqnRatePercent: '5.00',
    });

    vi.mocked(emitFocusNfse).mockResolvedValueOnce({
      ref: 'focus_ref_1',
      status: 'PROCESSANDO',
    });

    const created = await fiscalService.emitNfse(tenant.id, user.id, {
      clientId: client.id,
      grossValueCents: 60_000,
      serviceName: 'Servico custom',
      serviceCode: '8888',
    });

    expect(created.status).toBe('pending');

    const [stored] = await db.select().from(nfseList).where(eq(nfseList.id, created.id));
    expect(stored?.tomadorName).toBe('Clinica Snapshot');
    expect(stored?.serviceName).toBe('Servico custom');
    expect(stored?.serviceCode).toBe('8888');
  });

  it('T08: emitNfseInBatch emite 1 nota por cliente no fechamento', async () => {
    const user = await createTestUser(`${uid('fiscal-t08')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T08');

    await fiscalService.upsertFiscalSettings(tenant.id, user.id, {
      municipalRegistration: '998877',
      focusApiToken: 'focus_token',
      focusSandbox: true,
      defaultServiceCode: '1401',
      defaultServiceName: 'Servico mensal',
      issqnRatePercent: '5.00',
    });

    const c1 = await createTestClient(tenant.id, user.id, 'Cliente 1');
    const c2 = await createTestClient(tenant.id, user.id, 'Cliente 2');
    const c3 = await createTestClient(tenant.id, user.id, 'Cliente 3');

    const due = new Date('2026-03-15T12:00:00.000Z');
    await createAr(tenant.id, c1.id, 10_000, due);
    await createAr(tenant.id, c2.id, 20_000, due);
    await createAr(tenant.id, c3.id, 30_000, due);

    const [closing] = await db.insert(financialClosings).values({
      tenantId: tenant.id,
      period: '2026-03',
      totalJobs: 0,
      totalAmountCents: 60_000,
      paidAmountCents: 0,
      pendingAmountCents: 60_000,
      status: 'closed',
    }).returning();

    let counter = 0;
    vi.mocked(emitFocusNfse).mockImplementation(async () => {
      counter += 1;
      return { ref: `focus_batch_${counter}`, status: 'PROCESSANDO' };
    });

    const result = await fiscalService.emitNfseInBatch(tenant.id, { closingId: closing!.id }, user.id);
    expect(result.issued).toBe(3);
    expect(result.errors).toBe(0);

    const rows = await db.select().from(nfseList).where(eq(nfseList.tenantId, tenant.id));
    expect(rows).toHaveLength(3);
  });

  it('T09: cancelNfse pendente deve falhar', async () => {
    const user = await createTestUser(`${uid('fiscal-t09')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T09');
    const client = await createTestClient(tenant.id, user.id);

    const [nfse] = await db.insert(nfseList).values({
      tenantId: tenant.id,
      clientId: client.id,
      status: 'pending',
      gatewayId: 'nfse_pending_ref',
      serviceName: 'Servico',
      serviceCode: '1401',
      issqnRatePercent: '5.00',
      grossValueCents: 12_000,
      issqnCents: 600,
      netValueCents: 11_400,
      tomadorName: client.name,
    }).returning();

    await expect(fiscalService.cancelNfse(tenant.id, { nfseId: nfse!.id, reason: 'Cancel test' }, user.id)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    expect(cancelFocusNfse).not.toHaveBeenCalled();
  });

  it('T10: listBoletos respeita isolamento por tenant', async () => {
    const u1 = await createTestUser(`${uid('fiscal-t10a')}@test.com`);
    const u2 = await createTestUser(`${uid('fiscal-t10b')}@test.com`);
    const t1 = await createTestTenant(u1.id, 'Lab Fiscal T10A');
    const t2 = await createTestTenant(u2.id, 'Lab Fiscal T10B');
    const c1 = await createTestClient(t1.id, u1.id);
    const c2 = await createTestClient(t2.id, u2.id);

    await db.insert(boletos).values([
      { tenantId: t1.id, clientId: c1.id, amountCents: 1000, dueDate: new Date(), status: 'pending' },
      { tenantId: t2.id, clientId: c2.id, amountCents: 2000, dueDate: new Date(), status: 'pending' },
    ]);

    const result = await fiscalService.listBoletos(t1.id, { limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.tenantId).toBe(t1.id);
  });

  it('T11: listNfse respeita isolamento por tenant', async () => {
    const u1 = await createTestUser(`${uid('fiscal-t11a')}@test.com`);
    const u2 = await createTestUser(`${uid('fiscal-t11b')}@test.com`);
    const t1 = await createTestTenant(u1.id, 'Lab Fiscal T11A');
    const t2 = await createTestTenant(u2.id, 'Lab Fiscal T11B');
    const c1 = await createTestClient(t1.id, u1.id);
    const c2 = await createTestClient(t2.id, u2.id);

    await db.insert(nfseList).values([
      {
        tenantId: t1.id,
        clientId: c1.id,
        status: 'pending',
        serviceName: 'S1',
        serviceCode: '1401',
        issqnRatePercent: '5.00',
        grossValueCents: 1000,
        issqnCents: 50,
        netValueCents: 950,
        tomadorName: c1.name,
      },
      {
        tenantId: t2.id,
        clientId: c2.id,
        status: 'pending',
        serviceName: 'S2',
        serviceCode: '1401',
        issqnRatePercent: '5.00',
        grossValueCents: 2000,
        issqnCents: 100,
        netValueCents: 1900,
        tomadorName: c2.name,
      },
    ]);

    const result = await fiscalService.listNfse(t1.id, { limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.tenantId).toBe(t1.id);
  });

  it('T12: upsertFiscalSettings cria e atualiza sem duplicar', async () => {
    const user = await createTestUser(`${uid('fiscal-t12')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal T12');

    const created = await fiscalService.upsertFiscalSettings(tenant.id, user.id, {
      municipalRegistration: '123',
      taxRegime: 'simples',
      asaasSandbox: true,
      focusSandbox: true,
    });

    const updated = await fiscalService.upsertFiscalSettings(tenant.id, user.id, {
      municipalRegistration: '999',
      taxRegime: 'lucro_presumido',
      cityCode: '3550308',
    });

    const rows = await db.select().from(fiscalSettings).where(eq(fiscalSettings.tenantId, tenant.id));

    expect(created.tenantId).toBe(tenant.id);
    expect(updated.municipalRegistration).toBe('999');
    expect(rows).toHaveLength(1);
  });

  it('syncBoletoStatus consulta gateway e baixa AR quando pago', async () => {
    const user = await createTestUser(`${uid('fiscal-sync')}@test.com`);
    const tenant = await createTestTenant(user.id, 'Lab Fiscal Sync');
    const client = await createTestClient(tenant.id, user.id);
    const ar = await createAr(tenant.id, client.id, 15_000);

    await fiscalService.upsertFiscalSettings(tenant.id, user.id, {
      asaasApiKey: 'asaas_sync_key',
      asaasSandbox: true,
    });

    const [boleto] = await db.insert(boletos).values({
      tenantId: tenant.id,
      arId: ar.id,
      clientId: client.id,
      gatewayId: 'pay_sync_1',
      amountCents: 15_000,
      dueDate: new Date(),
      status: 'pending',
    }).returning();

    vi.mocked(queryAsaasBoleto).mockResolvedValueOnce({
      status: 'CONFIRMED',
      paidAt: new Date('2026-03-20T12:00:00.000Z'),
      paidValueCents: 15_000,
    });

    const synced = await fiscalService.syncBoletoStatus(tenant.id, boleto!.id);

    expect(synced.status).toBe('paid');

    const [arAfter] = await db.select().from(accountsReceivable).where(and(
      eq(accountsReceivable.tenantId, tenant.id),
      eq(accountsReceivable.id, ar.id),
    ));

    expect(arAfter?.status).toBe('paid');
  });
});
