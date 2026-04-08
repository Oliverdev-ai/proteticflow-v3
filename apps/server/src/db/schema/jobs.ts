import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  numeric,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@proteticflow/shared';

// Enums
// Alinhado ao PRD 04.03: pending→in_progress→quality_check→ready→delivered + cancelled
// 'overdue' é estado derivado (deadline < now), não armazenado no banco
export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'completed_with_rework',
  'delivered',
  'cancelled',
]);

export const jobSubTypeEnum = pgEnum('job_sub_type', [
  'standard',
  'proof',
  'rework',
]);

// ─── OS / Trabalho ───────────────────────────────────────────────────────────
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  code: varchar('code', { length: 32 }).notNull(),
  orderNumber: integer('order_number'),
  clientId: integer('client_id').notNull(),
  patientName: varchar('patient_name', { length: 255 }),
  tooth: varchar('tooth', { length: 32 }),
  // Campos PRD 04.01
  prothesisType: varchar('prothesis_type', { length: 128 }),
  material: varchar('material', { length: 128 }),
  color: varchar('color', { length: 64 }),
  instructions: text('instructions'),
  status: jobStatusEnum('status').default('pending').notNull(),
  jobSubType: jobSubTypeEnum('job_sub_type').default('standard').notNull(),
  isUrgent: boolean('is_urgent').notNull().default(false),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  suspendedBy: integer('suspended_by'),
  suspendReason: text('suspend_reason'),
  reworkReason: text('rework_reason'),
  reworkParentId: integer('rework_parent_id'),
  proofDueDate: timestamp('proof_due_date', { withTimezone: true }),
  proofReturnedAt: timestamp('proof_returned_at', { withTimezone: true }),
  // AP-02: totalCents é soma denormalizada dos job_items (atualizada via app)
  totalCents: integer('total_cents').notNull().default(0),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  // PRD 04.12: data de conclusão (quando status → ready)
  completedAt: timestamp('completed_at', { withTimezone: true }),
  // Cancelamento
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  notes: text('notes'),
  assignedTo: integer('assigned_to'),
  // PRD 04.04: etapa atual (FK → jobStages)
  currentStageId: integer('current_stage_id'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('jobs_tenant_idx').on(table.tenantId),
  index('jobs_tenant_code_idx').on(table.tenantId, table.code),
  index('jobs_order_number_idx').on(table.orderNumber),
  index('jobs_client_idx').on(table.clientId),
  index('jobs_assigned_to_idx').on(table.assignedTo),
  index('jobs_deadline_idx').on(table.deadline),
  index('jobs_subtype_idx').on(table.jobSubType),
  index('jobs_urgent_idx').on(table.isUrgent),
  index('jobs_suspended_at_idx').on(table.suspendedAt),
  index('jobs_rework_parent_idx').on(table.reworkParentId),
]);

// AP-02: Itens da OS com preço congelado no momento do pedido.
// unitPriceCents é snapshot de priceItems.priceCents — imune a reajustes futuros.
export const jobItems = pgTable('job_items', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id').notNull(),
  // FK nullable: null = item avulso sem catálogo
  priceItemId: integer('price_item_id'),
  // Snapshot do nome no momento da OS (imune a renomeação futura)
  serviceNameSnapshot: varchar('service_name_snapshot', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  // Preço unitário congelado no momento da criação (em centavos) — AP-02
  unitPriceCents: integer('unit_price_cents').notNull(),
  // Percentual de ajuste: -10.00 = desconto 10%, +5.00 = acréscimo 5%
  adjustmentPercent: numeric('adjustment_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  // totalCents = quantity * unitPriceCents * (1 + adjustmentPercent / 100) — arredondado
  totalCents: integer('total_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('job_items_tenant_idx').on(table.tenantId),
  index('job_items_job_idx').on(table.jobId),
  index('job_items_price_item_idx').on(table.priceItemId),
]);

export const jobLogs = pgTable('job_logs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id').notNull(),
  userId: integer('user_id'),
  userName: varchar('user_name', { length: 255 }),
  fromStatus: varchar('from_status', { length: 64 }),
  toStatus: varchar('to_status', { length: 64 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('job_logs_tenant_idx').on(table.tenantId),
  index('job_logs_job_idx').on(table.jobId),
  index('job_logs_created_at_idx').on(table.createdAt),
]);

// ─── PRD 04.04: Etapas de produção configuráveis por tenant ──────────────────
export const jobStages = pgTable('job_stages', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('job_stages_tenant_idx').on(table.tenantId),
  index('job_stages_order_idx').on(table.tenantId, table.sortOrder),
]);

// ─── PRD 04.06: Fotos por etapa ───────────────────────────────────────────────
export const jobPhotos = pgTable('job_photos', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id').notNull(),
  stageId: integer('stage_id'), // FK → jobStages (nullable)
  url: text('url').notNull(),   // S3/MinIO URL
  thumbnailUrl: text('thumbnail_url'),
  description: varchar('description', { length: 512 }),
  uploadedBy: integer('uploaded_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('job_photos_tenant_idx').on(table.tenantId),
  index('job_photos_job_idx').on(table.jobId),
]);

// ─── PAD-04: Counter com lock — NUNCA COUNT(*)+1 ──────────────────────────────
export const orderCounters = pgTable('order_counters', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().unique(),
  lastOrderNumber: integer('last_order_number').notNull().default(0),
}, (table) => [
  index('order_counters_tenant_idx').on(table.tenantId),
]);
