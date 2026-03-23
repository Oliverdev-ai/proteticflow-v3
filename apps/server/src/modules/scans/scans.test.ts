import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { tenants, tenantMembers } from '../../db/schema/tenants.js';
import { scans } from '../../db/schema/scans.js';
import { clients, priceItems, pricingTables } from '../../db/schema/clients.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { hashPassword } from '../../core/auth.js';
import { eq } from 'drizzle-orm';
import * as jobService from '../jobs/service.js';
import * as scanService from './service.js';

async function createTestUser(email: string) {
  const [u] = await db.insert(users).values({
    name: 'Test User',
    email,
    passwordHash: await hashPassword('Test123!'),
    role: 'user',
  }).returning();
  return u!;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function createTestClient(tenantId: number, userId: number, name: string) {
  const { createClient } = await import('../clients/service.js');
  const client = await createClient(tenantId, { name, priceAdjustmentPercent: 0 }, userId);
  if (!client) throw new Error('Falha ao criar cliente de teste');
  return client;
}

async function createTestJob(tenantId: number, clientId: number, userId: number) {
  const job = await jobService.createJob(tenantId, {
    clientId,
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    items: [{ serviceNameSnapshot: 'Coroa', quantity: 1, unitPriceCents: 10000, adjustmentPercent: 0 }],
  }, userId);
  if (!job) throw new Error('Falha ao criar job de teste');
  return job;
}

async function cleanup() {
  await db.delete(scans);
  await db.delete(jobLogs);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(orderCounters);
  await db.delete(priceItems);
  await db.delete(pricingTables);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('Scans Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Criar scan com scanner type e vinculos', async () => {
    const user = await createTestUser('scan1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Scan 1');
    const client = await createTestClient(tenant.id, user.id, 'Cliente 1');
    const job = await createTestJob(tenant.id, client.id, user.id);

    const created = await scanService.createScan(tenant.id, {
      scannerType: 'itero',
      jobId: job.id,
      clientId: client.id,
      notes: 'Scan inicial',
    }, user.id);

    expect(created.tenantId).toBe(tenant.id);
    expect(created.scannerType).toBe('itero');
    expect(created.jobId).toBe(job.id);
    expect(created.clientId).toBe(client.id);
  });

  it('2. Listar scans - filtra por tenant', async () => {
    const userA = await createTestUser('scan2a@test.com');
    const userB = await createTestUser('scan2b@test.com');
    const tenantA = await createTestTenant(userA.id, 'Lab Scan 2A');
    const tenantB = await createTestTenant(userB.id, 'Lab Scan 2B');

    await scanService.createScan(tenantA.id, { scannerType: 'outro' }, userA.id);
    const listB = await scanService.listScans(tenantB.id, { page: 1, limit: 20 });

    expect(listB.data.length).toBe(0);
  });

  it('3. Listar - filtra por printStatus', async () => {
    const user = await createTestUser('scan3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Scan 3');
    const created = await scanService.createScan(tenant.id, { scannerType: 'outro' }, user.id);
    await scanService.changePrintStatus(tenant.id, { scanId: created.id, status: 'sent' }, user.id);

    const filtered = await scanService.listScans(tenant.id, { page: 1, limit: 20, printStatus: 'sent' });
    expect(filtered.data.length).toBe(1);
    expect(filtered.data[0]?.scan.printStatus).toBe('sent');
  });

  it('4. Listar - filtra por jobId', async () => {
    const user = await createTestUser('scan4@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Scan 4');
    const client = await createTestClient(tenant.id, user.id, 'Cliente 4');
    const job = await createTestJob(tenant.id, client.id, user.id);

    await scanService.createScan(tenant.id, { scannerType: 'medit', jobId: job.id }, user.id);
    await scanService.createScan(tenant.id, { scannerType: 'medit' }, user.id);

    const filtered = await scanService.listScans(tenant.id, { page: 1, limit: 20, jobId: job.id });
    expect(filtered.data.length).toBe(1);
  });

  it('5. Update scan - atualiza vinculos', async () => {
    const user = await createTestUser('scan5@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Scan 5');
    const client = await createTestClient(tenant.id, user.id, 'Cliente 5');
    const job = await createTestJob(tenant.id, client.id, user.id);
    const created = await scanService.createScan(tenant.id, { scannerType: 'outro' }, user.id);

    const updated = await scanService.updateScan(tenant.id, created.id, {
      scannerType: 'carestream',
      clientId: client.id,
      jobId: job.id,
    });

    expect(updated.scannerType).toBe('carestream');
    expect(updated.clientId).toBe(client.id);
    expect(updated.jobId).toBe(job.id);
  });

  it('6. Parse XML iTero - extrai dentist, patient, procedure', async () => {
    const xml = `
      <iScanCaseOrder>
        <OrderId>OS-42</OrderId>
        <PatientInfo><Name>Paciente X</Name></PatientInfo>
        <DentistInfo><Name>Dr. Silva</Name><CRO>1234</CRO></DentistInfo>
        <Procedure>Coroa</Procedure>
      </iScanCaseOrder>
    `;
    const parsed = scanService.parseScannerXml(xml, 'itero');
    expect(parsed.orderId).toBe('OS-42');
    expect(parsed.patient).toBe('Paciente X');
    expect(parsed.dentist).toBe('Dr. Silva');
    expect(parsed.procedure).toBe('Coroa');
  });

  it('7. Parse XML generico - dados parseados ou raw fallback', async () => {
    const xml = `<root><foo>bar</foo><patient>Paciente Y</patient></root>`;
    const parsed = scanService.parseScannerXml(xml, 'outro');
    expect(parsed.patient).toBe('Paciente Y');
    expect(parsed.rawMetadataJson).toContain('"foo":"bar"');
  });

  it('8. waiting -> sent -> printing -> completed - cadeia valida', async () => {
    const user = await createTestUser('scan8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Scan 8');
    const created = await scanService.createScan(tenant.id, { scannerType: 'outro' }, user.id);

    await scanService.changePrintStatus(tenant.id, { scanId: created.id, status: 'sent' }, user.id);
    await scanService.changePrintStatus(tenant.id, { scanId: created.id, status: 'printing' }, user.id);
    const done = await scanService.changePrintStatus(tenant.id, { scanId: created.id, status: 'completed' }, user.id);

    expect(done.printStatus).toBe('completed');
    expect(done.printCompletedAt).not.toBeNull();
  });

  it('9. Transicao invalida rejeitada', async () => {
    const user = await createTestUser('scan9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Scan 9');
    const created = await scanService.createScan(tenant.id, { scannerType: 'outro' }, user.id);

    await expect(scanService.changePrintStatus(tenant.id, {
      scanId: created.id,
      status: 'completed',
    }, user.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('10. error registra printError', async () => {
    const user = await createTestUser('scan10@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Scan 10');
    const created = await scanService.createScan(tenant.id, { scannerType: 'outro' }, user.id);
    await scanService.changePrintStatus(tenant.id, { scanId: created.id, status: 'sent' }, user.id);

    const errored = await scanService.changePrintStatus(tenant.id, {
      scanId: created.id,
      status: 'error',
      printError: 'Falha de conexao',
    }, user.id);

    expect(errored.printStatus).toBe('error');
    expect(errored.printError).toBe('Falha de conexao');
  });

  it('11. Soft delete funciona', async () => {
    const user = await createTestUser('scan11@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Scan 11');
    const created = await scanService.createScan(tenant.id, { scannerType: 'outro' }, user.id);

    await scanService.deleteScan(tenant.id, created.id, user.id);
    const list = await scanService.listScans(tenant.id, { page: 1, limit: 20 });
    expect(list.data.length).toBe(0);

    const [raw] = await db.select().from(scans).where(eq(scans.id, created.id));
    expect(raw?.deletedAt).not.toBeNull();
  });

  it('12. Scans de tenant A invisiveis para B', async () => {
    const userA = await createTestUser('scan12a@test.com');
    const userB = await createTestUser('scan12b@test.com');
    const tenantA = await createTestTenant(userA.id, 'Lab Scan 12A');
    const tenantB = await createTestTenant(userB.id, 'Lab Scan 12B');

    const created = await scanService.createScan(tenantA.id, { scannerType: 'outro' }, userA.id);
    await expect(scanService.getScan(tenantB.id, created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
