import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@proteticflow/shared';

export const scannerTypeEnum = pgEnum('scanner_type', [
  'itero',
  'medit',
  '3shape',
  'carestream',
  'outro',
]);

export const scanPrintStatusEnum = pgEnum('scan_print_status', [
  'waiting',
  'sent',
  'printing',
  'completed',
  'error',
]);

export const scans = pgTable('scans', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id'),
  clientId: integer('client_id'),
  scannerType: scannerTypeEnum('scanner_type').default('outro').notNull(),
  stlUpperUrl: text('stl_upper_url'),
  stlLowerUrl: text('stl_lower_url'),
  xmlUrl: text('xml_url'),
  galleryImageUrl: text('gallery_image_url'),
  parsedOrderId: varchar('parsed_order_id', { length: 128 }),
  parsedDentist: varchar('parsed_dentist', { length: 255 }),
  parsedCro: varchar('parsed_cro', { length: 20 }),
  parsedPatient: varchar('parsed_patient', { length: 255 }),
  parsedProcedure: varchar('parsed_procedure', { length: 255 }),
  parsedDate: timestamp('parsed_date', { withTimezone: true }),
  parsedDeadline: timestamp('parsed_deadline', { withTimezone: true }),
  parsedAddress: text('parsed_address'),
  parsedNotes: text('parsed_notes'),
  rawMetadataJson: text('raw_metadata_json'),
  printStatus: scanPrintStatusEnum('print_status').default('waiting').notNull(),
  printerIp: varchar('printer_ip', { length: 45 }),
  printSentAt: timestamp('print_sent_at', { withTimezone: true }),
  printCompletedAt: timestamp('print_completed_at', { withTimezone: true }),
  printError: text('print_error'),
  notes: text('notes'),
  uploadedBy: integer('uploaded_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('scans_tenant_idx').on(table.tenantId),
  index('scans_job_idx').on(table.jobId),
  index('scans_client_idx').on(table.clientId),
  index('scans_print_status_idx').on(table.printStatus),
]);

