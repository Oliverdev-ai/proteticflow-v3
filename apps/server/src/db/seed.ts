import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.js';
import { hashPassword } from '../core/auth.js';
import { users } from './schema/users.js';
import { tenants, tenantMembers } from './schema/tenants.js';
import { clients, priceItems, pricingTables } from './schema/clients.js';
import { jobs, jobItems, jobLogs } from './schema/jobs.js';
import { accountsReceivable } from './schema/financials.js';
import { employees } from './schema/employees.js';
import { events } from './schema/agenda.js';
import { labSettings } from './schema/lab-settings.js';
import { materialCategories, materials, suppliers } from './schema/materials.js';

const DEMO_EMAIL = 'admin@demo.proteticflow.com.br';
const DEMO_PASSWORD = 'Demo123!';
const DEMO_TENANT_SLUG = 'laboratorio-proteticflow-demo';
const DEMO_TENANT_NAME = 'Laboratorio ProteticFlow Demo';
const DEMO_PRICING_NAME = 'Tabela Padrao';

type SeedClient = {
  name: string;
  clinic: string;
  document: string;
  city: string;
  state: string;
};

type SeedPriceItem = {
  name: string;
  category: string;
  priceCents: number;
  estimatedDays: number;
  code: string;
};

type SeedJob = {
  code: string;
  clientName: string;
  patientName: string;
  status: 'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered';
  deadlineOffsetDays: number;
  itemName: string;
};

const seedClients: SeedClient[] = [
  { name: 'Clinica Sorriso Alfa', clinic: 'Sorriso Alfa', document: '04805792000110', city: 'Sao Paulo', state: 'SP' },
  { name: 'Odonto Prime Centro', clinic: 'Odonto Prime', document: '91125386000103', city: 'Campinas', state: 'SP' },
  { name: 'Instituto Dental Lumiere', clinic: 'Lumiere', document: '31243831000135', city: 'Curitiba', state: 'PR' },
  { name: 'Clinica Nova Arcada', clinic: 'Nova Arcada', document: '90845645000128', city: 'Belo Horizonte', state: 'MG' },
  { name: 'Dr. Marcos e Equipe', clinic: 'Marcos Odonto', document: '77810633000130', city: 'Florianopolis', state: 'SC' },
];

const seedPriceItems: SeedPriceItem[] = [
  { name: 'Coroa Unit Zirconia', category: 'Coroas', priceCents: 45000, estimatedDays: 5, code: 'SER-001' },
  { name: 'Ponte 3 Elementos', category: 'Pontes', priceCents: 98000, estimatedDays: 7, code: 'SER-002' },
  { name: 'Protese Total Superior', category: 'Proteses', priceCents: 120000, estimatedDays: 8, code: 'SER-003' },
  { name: 'Protese Total Inferior', category: 'Proteses', priceCents: 118000, estimatedDays: 8, code: 'SER-004' },
  { name: 'Placa Miorrelaxante', category: 'Placas', priceCents: 28000, estimatedDays: 4, code: 'SER-005' },
  { name: 'Mockup Estetico', category: 'Estetica', priceCents: 35000, estimatedDays: 3, code: 'SER-006' },
  { name: 'Coroa Metaloceramica', category: 'Coroas', priceCents: 39000, estimatedDays: 6, code: 'SER-007' },
  { name: 'Faceta Ceramica', category: 'Facetas', priceCents: 32000, estimatedDays: 4, code: 'SER-008' },
  { name: 'Guia Cirurgico Impresso', category: 'Guias', priceCents: 52000, estimatedDays: 5, code: 'SER-009' },
  { name: 'Protese Parcial Removivel', category: 'Proteses', priceCents: 87000, estimatedDays: 7, code: 'SER-010' },
];

const seedJobs: SeedJob[] = [
  { code: 'DEMO-0001', clientName: 'Clinica Sorriso Alfa', patientName: 'Ana Ribeiro', status: 'pending', deadlineOffsetDays: 3, itemName: 'Coroa Unit Zirconia' },
  { code: 'DEMO-0002', clientName: 'Odonto Prime Centro', patientName: 'Paulo Mendes', status: 'in_progress', deadlineOffsetDays: 4, itemName: 'Ponte 3 Elementos' },
  { code: 'DEMO-0003', clientName: 'Instituto Dental Lumiere', patientName: 'Julia Costa', status: 'quality_check', deadlineOffsetDays: 2, itemName: 'Faceta Ceramica' },
  { code: 'DEMO-0004', clientName: 'Clinica Nova Arcada', patientName: 'Luiz Ramos', status: 'ready', deadlineOffsetDays: 1, itemName: 'Guia Cirurgico Impresso' },
  { code: 'DEMO-0005', clientName: 'Dr. Marcos e Equipe', patientName: 'Carla Dias', status: 'delivered', deadlineOffsetDays: -1, itemName: 'Protese Total Superior' },
  { code: 'DEMO-0006', clientName: 'Clinica Sorriso Alfa', patientName: 'Tiago Alves', status: 'pending', deadlineOffsetDays: 5, itemName: 'Mockup Estetico' },
  { code: 'DEMO-0007', clientName: 'Odonto Prime Centro', patientName: 'Renata Lima', status: 'in_progress', deadlineOffsetDays: 3, itemName: 'Placa Miorrelaxante' },
  { code: 'DEMO-0008', clientName: 'Instituto Dental Lumiere', patientName: 'Daniel Vieira', status: 'ready', deadlineOffsetDays: 0, itemName: 'Protese Parcial Removivel' },
];

function plusDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function getOrCreateAdminUser() {
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      name: 'Admin Demo',
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      role: 'admin',
      isActive: true,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (created) return created;

  const [fallback] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (!fallback) throw new Error('Falha ao obter usuario admin demo');
  return fallback;
}

async function getOrCreateTenant() {
  const [existing] = await db.select().from(tenants).where(eq(tenants.slug, DEMO_TENANT_SLUG)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(tenants)
    .values({
      name: DEMO_TENANT_NAME,
      slug: DEMO_TENANT_SLUG,
      plan: 'trial',
      planExpiresAt: plusDays(14),
      fullAccessUntil: plusDays(14),
      managerActionsThisMonth: 0,
      managerActionsMonthRef: new Date(),
      isActive: true,
      city: 'Sao Paulo',
      state: 'SP',
      phone: '(11) 4000-0000',
      email: 'contato@demo.proteticflow.com.br',
    })
    .onConflictDoNothing({ target: tenants.slug })
    .returning();

  if (created) return created;

  const [fallback] = await db.select().from(tenants).where(eq(tenants.slug, DEMO_TENANT_SLUG)).limit(1);
  if (!fallback) throw new Error('Falha ao obter tenant demo');
  return fallback;
}

async function ensureMembership(tenantId: number, userId: number) {
  await db
    .insert(tenantMembers)
    .values({
      tenantId,
      userId,
      role: 'superadmin',
      isActive: true,
    })
    .onConflictDoNothing({ target: [tenantMembers.tenantId, tenantMembers.userId] });

  await db.update(users).set({ activeTenantId: tenantId, role: 'admin' }).where(eq(users.id, userId));
}

async function seedClientsForTenant(tenantId: number, userId: number) {
  for (const item of seedClients) {
    await db
      .insert(clients)
      .values({
        tenantId,
        createdBy: userId,
        name: item.name,
        clinic: item.clinic,
        documentType: 'cnpj',
        document: item.document,
        city: item.city,
        state: item.state,
        phone: '(11) 95555-0000',
        email: `${item.clinic.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        status: 'active',
      })
      .onConflictDoNothing({ target: [clients.tenantId, clients.document] });
  }

  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), inArray(clients.document, seedClients.map((item) => item.document))));
}

async function seedPricing(tenantId: number) {
  await db
    .insert(pricingTables)
    .values({
      tenantId,
      name: DEMO_PRICING_NAME,
      description: 'Tabela principal de demonstracao',
      isDefault: true,
      isActive: true,
    })
    .onConflictDoNothing({ target: [pricingTables.tenantId, pricingTables.name] });

  const [table] = await db
    .select({ id: pricingTables.id })
    .from(pricingTables)
    .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.name, DEMO_PRICING_NAME)))
    .limit(1);

  if (!table) throw new Error('Falha ao obter tabela de precos demo');

  for (const item of seedPriceItems) {
    await db
      .insert(priceItems)
      .values({
        tenantId,
        pricingTableId: table.id,
        name: item.name,
        category: item.category,
        code: item.code,
        priceCents: item.priceCents,
        estimatedDays: item.estimatedDays,
        isActive: true,
      })
      .onConflictDoNothing({ target: [priceItems.pricingTableId, priceItems.name] });
  }

  const allItems = await db
    .select({ id: priceItems.id, name: priceItems.name, priceCents: priceItems.priceCents })
    .from(priceItems)
    .where(and(eq(priceItems.tenantId, tenantId), eq(priceItems.pricingTableId, table.id)));

  return { tableId: table.id, items: allItems };
}

async function seedJobsForTenant(
  tenantId: number,
  userId: number,
  allClients: Array<{ id: number; name: string }>,
  allItems: Array<{ id: number; name: string; priceCents: number }>
) {
  const clientByName = new Map(allClients.map((client) => [client.name, client]));
  const itemByName = new Map(allItems.map((item) => [item.name, item]));

  const existingJobs = await db
    .select({ id: jobs.id, code: jobs.code })
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.code, seedJobs.map((job) => job.code))));
  const existingCodes = new Set(existingJobs.map((item) => item.code));

  for (const seedJob of seedJobs) {
    if (existingCodes.has(seedJob.code)) continue;

    const client = clientByName.get(seedJob.clientName);
    const item = itemByName.get(seedJob.itemName);
    if (!client || !item) continue;

    const deadline = plusDays(seedJob.deadlineOffsetDays);
    const deliveredAt = seedJob.status === 'delivered' ? plusDays(seedJob.deadlineOffsetDays + 1) : null;
    const completedAt = seedJob.status === 'ready' || seedJob.status === 'delivered' ? plusDays(seedJob.deadlineOffsetDays) : null;

    const [createdJob] = await db
      .insert(jobs)
      .values({
        tenantId,
        code: seedJob.code,
        clientId: client.id,
        patientName: seedJob.patientName,
        status: seedJob.status,
        deadline,
        totalCents: item.priceCents,
        createdBy: userId,
        deliveredAt,
        completedAt,
      })
      .returning();

    if (!createdJob) continue;

    await db.insert(jobItems).values({
      tenantId,
      jobId: createdJob.id,
      priceItemId: item.id,
      serviceNameSnapshot: item.name,
      quantity: 1,
      unitPriceCents: item.priceCents,
      adjustmentPercent: '0',
      totalCents: item.priceCents,
    });

    await db.insert(jobLogs).values({
      tenantId,
      jobId: createdJob.id,
      userId,
      userName: 'Admin Demo',
      toStatus: seedJob.status,
      notes: `Seed inicial (${seedJob.status})`,
    });

    await db.insert(accountsReceivable).values({
      tenantId,
      jobId: createdJob.id,
      clientId: client.id,
      amountCents: item.priceCents,
      description: `Recebivel ${seedJob.code}`,
      dueDate: plusDays(seedJob.deadlineOffsetDays + 7),
      status: seedJob.status === 'delivered' ? 'paid' : 'pending',
      paidAt: seedJob.status === 'delivered' ? new Date() : null,
      paymentMethod: seedJob.status === 'delivered' ? 'pix' : null,
    });
  }
}

async function seedEmployees(tenantId: number, userId: number) {
  const seedData = [
    { name: 'Marina Souza', position: 'Protetica Senior', type: 'protesista' as const, contractType: 'clt' as const, baseSalaryCents: 420000 },
    { name: 'Rafael Gomes', position: 'Auxiliar de Producao', type: 'auxiliar' as const, contractType: 'clt' as const, baseSalaryCents: 240000 },
    { name: 'Aline Castro', position: 'Recepcao', type: 'recepcionista' as const, contractType: 'clt' as const, baseSalaryCents: 210000 },
  ];

  const existing = await db
    .select({ name: employees.name })
    .from(employees)
    .where(and(eq(employees.tenantId, tenantId), inArray(employees.name, seedData.map((item) => item.name))));
  const existingNames = new Set(existing.map((item) => item.name));

  for (const item of seedData) {
    if (existingNames.has(item.name)) continue;
    await db.insert(employees).values({
      tenantId,
      createdBy: userId,
      name: item.name,
      position: item.position,
      type: item.type,
      contractType: item.contractType,
      baseSalaryCents: item.baseSalaryCents,
      isActive: true,
      city: 'Sao Paulo',
      state: 'SP',
    });
  }
}

async function seedInventory(tenantId: number, userId: number) {
  const categoryName = 'Materiais Clinicos';
  const [existingCategory] = await db
    .select({ id: materialCategories.id })
    .from(materialCategories)
    .where(and(eq(materialCategories.tenantId, tenantId), eq(materialCategories.name, categoryName)))
    .limit(1);

  let categoryId = existingCategory?.id;
  if (!categoryId) {
    const [createdCategory] = await db
      .insert(materialCategories)
      .values({
        tenantId,
        name: categoryName,
        description: 'Categoria seed demo',
      })
      .returning();
    categoryId = createdCategory?.id;
  }

  const supplierSeed = [
    { name: 'Dental Supply Prime', cnpj: '62046329000140', contact: 'Comercial Prime' },
    { name: 'BioMateriais Brasil', cnpj: '32595442000178', contact: 'Equipe BioMateriais' },
  ];

  const existingSuppliers = await db
    .select({ name: suppliers.name })
    .from(suppliers)
    .where(and(eq(suppliers.tenantId, tenantId), inArray(suppliers.name, supplierSeed.map((item) => item.name))));
  const existingSupplierNames = new Set(existingSuppliers.map((item) => item.name));

  for (const supplier of supplierSeed) {
    if (existingSupplierNames.has(supplier.name)) continue;
    await db.insert(suppliers).values({
      tenantId,
      name: supplier.name,
      cnpj: supplier.cnpj,
      contact: supplier.contact,
      email: `${supplier.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      isActive: true,
    });
  }

  const allSuppliers = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(and(eq(suppliers.tenantId, tenantId), inArray(suppliers.name, supplierSeed.map((item) => item.name))));
  const supplierByName = new Map(allSuppliers.map((item) => [item.name, item.id]));

  const materialSeed = [
    { name: 'Zirconia Bloco A2', code: 'MAT-001', supplier: 'Dental Supply Prime', unit: 'un', currentStock: '40', minStock: '10', averageCostCents: 18000 },
    { name: 'Resina Fotopolimerizavel', code: 'MAT-002', supplier: 'BioMateriais Brasil', unit: 'kg', currentStock: '3.500', minStock: '1.000', averageCostCents: 32000 },
    { name: 'Gesso Tipo IV', code: 'MAT-003', supplier: 'Dental Supply Prime', unit: 'kg', currentStock: '25.000', minStock: '8.000', averageCostCents: 9500 },
    { name: 'Liga Metalica CoCr', code: 'MAT-004', supplier: 'BioMateriais Brasil', unit: 'kg', currentStock: '2.200', minStock: '0.800', averageCostCents: 54000 },
    { name: 'Ceramica Estratificacao', code: 'MAT-005', supplier: 'Dental Supply Prime', unit: 'kit', currentStock: '12', minStock: '4', averageCostCents: 28000 },
  ];

  const existingMaterials = await db
    .select({ name: materials.name })
    .from(materials)
    .where(and(eq(materials.tenantId, tenantId), inArray(materials.name, materialSeed.map((item) => item.name))));
  const existingMaterialNames = new Set(existingMaterials.map((item) => item.name));

  for (const item of materialSeed) {
    if (existingMaterialNames.has(item.name)) continue;

    await db.insert(materials).values({
      tenantId,
      categoryId: categoryId ?? null,
      supplierId: supplierByName.get(item.supplier) ?? null,
      createdBy: userId,
      name: item.name,
      code: item.code,
      unit: item.unit,
      currentStock: item.currentStock,
      minStock: item.minStock,
      averageCostCents: item.averageCostCents,
      isActive: true,
    });
  }
}

async function seedEvents(tenantId: number, userId: number, clientsList: Array<{ id: number; name: string }>) {
  const clientByName = new Map(clientsList.map((client) => [client.name, client.id]));
  const eventSeed = [
    { title: 'Prova Clinica Sorriso Alfa', type: 'prova' as const, startAt: plusDays(1), endAt: plusDays(1), clientName: 'Clinica Sorriso Alfa' },
    { title: 'Entrega Odonto Prime', type: 'entrega' as const, startAt: plusDays(2), endAt: plusDays(2), clientName: 'Odonto Prime Centro' },
    { title: 'Reuniao Operacional Semanal', type: 'reuniao' as const, startAt: plusDays(3), endAt: plusDays(3), clientName: null },
  ];

  const existingEvents = await db
    .select({ title: events.title })
    .from(events)
    .where(and(eq(events.tenantId, tenantId), inArray(events.title, eventSeed.map((item) => item.title))));
  const existingTitles = new Set(existingEvents.map((item) => item.title));

  for (const event of eventSeed) {
    if (existingTitles.has(event.title)) continue;
    await db.insert(events).values({
      tenantId,
      createdBy: userId,
      title: event.title,
      type: event.type,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: false,
      recurrence: 'none',
      clientId: event.clientName ? (clientByName.get(event.clientName) ?? null) : null,
    });
  }
}

async function ensureLabSettings(tenantId: number) {
  await db
    .insert(labSettings)
    .values({
      tenantId,
      labName: DEMO_TENANT_NAME,
      email: 'contato@demo.proteticflow.com.br',
      city: 'Sao Paulo',
      state: 'SP',
      primaryColor: '#8b5cf6',
      secondaryColor: '#0f172a',
      reportHeader: 'ProteticFlow Demo',
      reportFooter: 'Gerado automaticamente para ambiente de demonstracao',
    })
    .onConflictDoNothing({ target: labSettings.tenantId });
}

async function refreshTenantCounters(tenantId: number) {
  const [clientCounter] = await db
    .select({ value: sql<number>`count(*)` })
    .from(clients)
    .where(eq(clients.tenantId, tenantId));
  const [jobCounter] = await db
    .select({ value: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.tenantId, tenantId));
  const [userCounter] = await db
    .select({ value: sql<number>`count(*)` })
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));
  const [pricingCounter] = await db
    .select({ value: sql<number>`count(*)` })
    .from(pricingTables)
    .where(eq(pricingTables.tenantId, tenantId));

  await db
    .update(tenants)
    .set({
      clientCount: Number(clientCounter?.value ?? 0),
      jobCountThisMonth: Number(jobCounter?.value ?? 0),
      userCount: Number(userCounter?.value ?? 0),
      priceTableCount: Number(pricingCounter?.value ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

async function seed() {
  console.warn('[seed] Iniciando seed de demonstracao...');

  const user = await getOrCreateAdminUser();
  const tenant = await getOrCreateTenant();
  await ensureMembership(tenant.id, user.id);

  const clientsList = await seedClientsForTenant(tenant.id, user.id);
  const pricingResult = await seedPricing(tenant.id);
  await seedJobsForTenant(tenant.id, user.id, clientsList, pricingResult.items);
  await seedEmployees(tenant.id, user.id);
  await seedInventory(tenant.id, user.id);
  await seedEvents(tenant.id, user.id, clientsList);
  await ensureLabSettings(tenant.id);
  await refreshTenantCounters(tenant.id);

  console.warn('[seed] Seed concluido com sucesso.');
  console.warn(`[seed] Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[seed] Erro:', error);
    process.exit(1);
  });

