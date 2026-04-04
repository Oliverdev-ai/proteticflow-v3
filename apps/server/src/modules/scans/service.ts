import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { XMLParser } from 'fast-xml-parser';
import { db } from '../../db/index.js';
import { scans } from '../../db/schema/scans.js';
import { jobs } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { buildPublicUrl, generateDownloadUrl, uploadBuffer } from '../../core/storage.js';
import { logger } from '../../logger.js';
import type {
  createScanSchema,
  updateScanSchema,
  changePrintStatusSchema,
  listScansSchema,
} from '@proteticflow/shared';
import type { z } from 'zod';

type CreateScanInput = z.infer<typeof createScanSchema>;
type UpdateScanInput = z.infer<typeof updateScanSchema>;
type ChangePrintStatusInput = z.infer<typeof changePrintStatusSchema>;
type ListScansInput = z.infer<typeof listScansSchema>;
type FileType = 'stl_upper' | 'stl_lower' | 'xml' | 'gallery';
type ScanPrintStatus = 'waiting' | 'sent' | 'printing' | 'completed' | 'error';
type ScannerType = 'itero' | 'medit' | '3shape' | 'carestream' | 'outro';

type ParsedScanData = {
  orderId: string | undefined;
  dentist: string | undefined;
  cro: string | undefined;
  patient: string | undefined;
  procedure: string | undefined;
  date: Date | undefined;
  deadline: Date | undefined;
  address: string | undefined;
  notes: string | undefined;
  rawMetadataJson: string;
};

const VALID_TRANSITIONS: Record<ScanPrintStatus, ScanPrintStatus[]> = {
  waiting: ['sent'],
  sent: ['printing', 'error'],
  printing: ['completed', 'error'],
  completed: [],
  error: [],
};

function toDateOrUndefined(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function pickFirst(...values: unknown[]): string | undefined {
  for (const value of values) {
    const parsed = asText(value);
    if (parsed) return parsed;
  }
  return undefined;
}

function withDate(base: Date, deltaDays: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

export function parseScannerXml(xmlContent: string, scannerType: string): ParsedScanData {
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const parsed = parser.parse(xmlContent) as Record<string, unknown>;

  const scanner = (scannerType as ScannerType) ?? 'outro';
  let result: Omit<ParsedScanData, 'rawMetadataJson'> = {
    orderId: undefined,
    dentist: undefined,
    cro: undefined,
    patient: undefined,
    procedure: undefined,
    date: undefined,
    deadline: undefined,
    address: undefined,
    notes: undefined,
  };

  if (scanner === 'itero') {
    const order = (parsed.iScanCaseOrder ?? parsed.IScanCaseOrder ?? {}) as Record<string, unknown>;
    const patient = (order.PatientInfo ?? {}) as Record<string, unknown>;
    const dentist = (order.DentistInfo ?? {}) as Record<string, unknown>;
    result = {
      orderId: pickFirst(order.OrderId, order.CaseId, order.CaseNumber),
      dentist: pickFirst(dentist.Name, dentist.FullName),
      cro: pickFirst(dentist.CRO, dentist.License),
      patient: pickFirst(patient.Name, patient.FullName),
      procedure: pickFirst(order.Procedure, order.TreatmentType),
      date: toDateOrUndefined(pickFirst(order.Date, order.CreatedAt)),
      deadline: toDateOrUndefined(pickFirst(order.DeliveryDate, order.Deadline)),
      address: pickFirst(order.Address, dentist.Address),
      notes: pickFirst(order.Notes, order.Comments),
    };
  } else if (scanner === 'medit') {
    const order = (parsed.Case ?? parsed.case ?? {}) as Record<string, unknown>;
    const patient = (order.Patient ?? {}) as Record<string, unknown>;
    const doctor = (order.Doctor ?? {}) as Record<string, unknown>;
    result = {
      orderId: pickFirst(order.OrderId, order.Id, order.CaseId),
      dentist: pickFirst(doctor.Name, doctor.FullName),
      cro: pickFirst(doctor.CRO, doctor.License),
      patient: pickFirst(patient.Name, patient.FullName),
      procedure: pickFirst(order.Procedure, order.Treatment),
      date: toDateOrUndefined(pickFirst(order.Date, order.CreatedAt)),
      deadline: toDateOrUndefined(pickFirst(order.Deadline, order.DeliveryDate)),
      address: pickFirst(doctor.Address),
      notes: pickFirst(order.Notes, order.Comment),
    };
  } else if (scanner === '3shape') {
    const order = (parsed.Order ?? parsed.order ?? {}) as Record<string, unknown>;
    const patient = (order.Patient ?? {}) as Record<string, unknown>;
    const practitioner = (order.Practitioner ?? {}) as Record<string, unknown>;
    result = {
      orderId: pickFirst(order.OrderId, order.Id),
      dentist: pickFirst(practitioner.Name, practitioner.FullName),
      cro: pickFirst(practitioner.CRO, practitioner.License),
      patient: pickFirst(patient.Name, patient.FullName),
      procedure: pickFirst(order.Procedure, order.ProductType),
      date: toDateOrUndefined(pickFirst(order.Date, order.CreatedAt)),
      deadline: toDateOrUndefined(pickFirst(order.DeliveryDate, order.Deadline)),
      address: pickFirst(practitioner.Address),
      notes: pickFirst(order.Notes, order.Comment),
    };
  } else if (scanner === 'carestream') {
    const order = (parsed.Prescription ?? parsed.prescription ?? {}) as Record<string, unknown>;
    const patient = (order.Patient ?? {}) as Record<string, unknown>;
    const provider = (order.Provider ?? order.Dentist ?? {}) as Record<string, unknown>;
    result = {
      orderId: pickFirst(order.OrderId, order.PrescriptionId),
      dentist: pickFirst(provider.Name, provider.FullName),
      cro: pickFirst(provider.CRO, provider.License),
      patient: pickFirst(patient.Name, patient.FullName),
      procedure: pickFirst(order.Procedure, order.Treatment),
      date: toDateOrUndefined(pickFirst(order.Date, order.CreatedAt)),
      deadline: toDateOrUndefined(pickFirst(order.DueDate, order.Deadline)),
      address: pickFirst(provider.Address),
      notes: pickFirst(order.Notes, order.Comment),
    };
  } else {
    result = {
      orderId: pickFirst(parsed.orderId, parsed.order_id, parsed.id),
      dentist: pickFirst(parsed.dentist, parsed.doctor, parsed.practitioner),
      cro: pickFirst(parsed.cro, parsed.license),
      patient: pickFirst(parsed.patient, parsed.patientName),
      procedure: pickFirst(parsed.procedure, parsed.treatment),
      date: toDateOrUndefined(pickFirst(parsed.date, parsed.createdAt)),
      deadline: toDateOrUndefined(pickFirst(parsed.deadline, parsed.deliveryDate)),
      address: pickFirst(parsed.address),
      notes: pickFirst(parsed.notes, parsed.comment),
    };
  }

  return {
    ...result,
    rawMetadataJson: JSON.stringify(parsed),
  };
}

function mapFileTypeToColumn(fileType: FileType): keyof typeof scans.$inferInsert {
  if (fileType === 'stl_upper') return 'stlUpperUrl';
  if (fileType === 'stl_lower') return 'stlLowerUrl';
  if (fileType === 'xml') return 'xmlUrl';
  return 'galleryImageUrl';
}

function mimeTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'stl') return 'model/stl';
  if (ext === 'xml') return 'application/xml';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

async function getScanOwnedByTenant(tenantId: number, scanId: number) {
  const [scan] = await db.select().from(scans).where(
    and(eq(scans.tenantId, tenantId), eq(scans.id, scanId), isNull(scans.deletedAt)),
  );
  if (!scan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scan nao encontrado' });
  return scan;
}

async function withDownloadUrl(keyOrUrl: string | null): Promise<string | null> {
  if (!keyOrUrl) return null;
  try {
    return await generateDownloadUrl(keyOrUrl);
  } catch {
    return buildPublicUrl(keyOrUrl);
  }
}

export async function createScan(tenantId: number, input: CreateScanInput, userId: number) {
  const scanData: typeof scans.$inferInsert = {
    tenantId,
    scannerType: input.scannerType,
    uploadedBy: userId,
  };
  if (input.jobId !== undefined) scanData.jobId = input.jobId;
  if (input.clientId !== undefined) scanData.clientId = input.clientId;
  if (input.notes !== undefined) scanData.notes = input.notes;

  const [scan] = await db.insert(scans).values(scanData).returning();
  if (!scan) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar scan' });

  logger.info({ action: 'scan.create', tenantId, scanId: scan.id, scannerType: scan.scannerType }, 'Scan criado');
  return scan;
}

export async function uploadScanFile(
  tenantId: number,
  scanId: number,
  fileType: FileType,
  buffer: Buffer,
  filename: string,
  userId: number,
) {
  const scan = await getScanOwnedByTenant(tenantId, scanId);
  const key = `tenants/${tenantId}/scans/${scanId}/${fileType}_${filename}`;
  const contentType = mimeTypeFromFilename(filename);

  await uploadBuffer(key, buffer, contentType);

  const updateData: Partial<typeof scans.$inferInsert> = {
    [mapFileTypeToColumn(fileType)]: key,
    updatedAt: new Date(),
  };

  if (fileType === 'xml') {
    const xmlContent = buffer.toString('utf-8');
    const parsedData = parseScannerXml(xmlContent, scan.scannerType);
    updateData.parsedOrderId = parsedData.orderId ?? null;
    updateData.parsedDentist = parsedData.dentist ?? null;
    updateData.parsedCro = parsedData.cro ?? null;
    updateData.parsedPatient = parsedData.patient ?? null;
    updateData.parsedProcedure = parsedData.procedure ?? null;
    updateData.parsedDate = parsedData.date ?? null;
    updateData.parsedDeadline = parsedData.deadline ?? null;
    updateData.parsedAddress = parsedData.address ?? null;
    updateData.parsedNotes = parsedData.notes ?? null;
    updateData.rawMetadataJson = parsedData.rawMetadataJson;

    logger.info({
      action: 'scan.xml.parsed',
      tenantId,
      scanId,
      parsedFields: Object.keys(parsedData).filter((k) => k !== 'rawMetadataJson'),
    }, 'XML de scanner processado');
  }

  const [updated] = await db.update(scans)
    .set(updateData)
    .where(and(eq(scans.id, scanId), eq(scans.tenantId, tenantId)))
    .returning();
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scan nao encontrado' });

  logger.info({ action: 'scan.upload', tenantId, scanId, fileType, filename, userId }, 'Arquivo de scan enviado');
  return updated;
}

export async function listScans(tenantId: number, filters: ListScansInput) {
  const conditions = [eq(scans.tenantId, tenantId), isNull(scans.deletedAt)];
  if (filters.jobId) conditions.push(eq(scans.jobId, filters.jobId));
  if (filters.clientId) conditions.push(eq(scans.clientId, filters.clientId));
  if (filters.scannerType) conditions.push(eq(scans.scannerType, filters.scannerType));
  if (filters.printStatus) conditions.push(eq(scans.printStatus, filters.printStatus));
  if (filters.dateFrom) conditions.push(gte(scans.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(scans.createdAt, new Date(filters.dateTo)));
  if (filters.orphanOnly) conditions.push(sql`${scans.jobId} is null`);

  const offset = (filters.page - 1) * filters.limit;
  const data = await db.select({
    scan: scans,
    clientName: clients.name,
    jobCode: jobs.code,
  }).from(scans)
    .leftJoin(clients, eq(scans.clientId, clients.id))
    .leftJoin(jobs, eq(scans.jobId, jobs.id))
    .where(and(...conditions))
    .orderBy(desc(scans.createdAt))
    .limit(filters.limit)
    .offset(offset);

  const [totalRow] = await db.select({ total: sql<number>`count(*)` }).from(scans).where(and(...conditions));

  return { data, total: Number(totalRow?.total ?? 0) };
}

export async function getScan(tenantId: number, scanId: number) {
  const [row] = await db.select({
    scan: scans,
    clientName: clients.name,
    jobCode: jobs.code,
  }).from(scans)
    .leftJoin(clients, eq(scans.clientId, clients.id))
    .leftJoin(jobs, eq(scans.jobId, jobs.id))
    .where(and(eq(scans.tenantId, tenantId), eq(scans.id, scanId), isNull(scans.deletedAt)));

  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scan nao encontrado' });

  return {
    ...row,
    downloadUrls: {
      stlUpper: await withDownloadUrl(row.scan.stlUpperUrl),
      stlLower: await withDownloadUrl(row.scan.stlLowerUrl),
      xml: await withDownloadUrl(row.scan.xmlUrl),
      gallery: await withDownloadUrl(row.scan.galleryImageUrl),
    },
  };
}

export async function updateScan(tenantId: number, scanId: number, input: UpdateScanInput) {
  await getScanOwnedByTenant(tenantId, scanId);
  const updates: Partial<typeof scans.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.jobId !== undefined) updates.jobId = input.jobId;
  if (input.clientId !== undefined) updates.clientId = input.clientId;
  if (input.scannerType !== undefined) updates.scannerType = input.scannerType;
  if (input.notes !== undefined) updates.notes = input.notes;

  const [updated] = await db.update(scans)
    .set(updates)
    .where(and(eq(scans.tenantId, tenantId), eq(scans.id, scanId)))
    .returning();
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scan nao encontrado' });
  return updated;
}

export async function deleteScan(tenantId: number, scanId: number, userId: number) {
  await getScanOwnedByTenant(tenantId, scanId);
  await db.update(scans)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(and(eq(scans.id, scanId), eq(scans.tenantId, tenantId)));
}

export async function changePrintStatus(tenantId: number, input: ChangePrintStatusInput, userId: number) {
  const scan = await getScanOwnedByTenant(tenantId, input.scanId);
  const from = scan.printStatus as ScanPrintStatus;
  const to = input.status as ScanPrintStatus;

  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Transicao invalida de ${from} para ${to}`,
    });
  }

  if (to === 'error' && !input.printError) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'printError e obrigatorio ao enviar status error' });
  }

  const updateData: Partial<typeof scans.$inferInsert> = {
    printStatus: to,
    printerIp: input.printerIp ?? scan.printerIp,
    printError: to === 'error' ? (input.printError ?? null) : null,
    printSentAt: to === 'sent' ? new Date() : scan.printSentAt,
    printCompletedAt: to === 'completed' ? new Date() : scan.printCompletedAt,
    updatedAt: new Date(),
  };

  const [updated] = await db.update(scans)
    .set(updateData)
    .where(and(eq(scans.id, input.scanId), eq(scans.tenantId, tenantId)))
    .returning();
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scan nao encontrado' });

  logger.info({
    action: 'scan.print.status',
    tenantId,
    scanId: input.scanId,
    from,
    to,
    userId,
  }, 'Status de impressao alterado');

  return updated;
}

export async function sendToPrinter(tenantId: number, scanId: number, printerIp: string, userId: number) {
  const scan = await getScanOwnedByTenant(tenantId, scanId);
  const stlKey = scan.stlUpperUrl ?? scan.stlLowerUrl;
  if (!stlKey) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Scan nao possui STL para envio' });

  const stlUrl = await withDownloadUrl(stlKey);
  if (!stlUrl) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nao foi possivel gerar URL do STL' });

  try {
    await fetch(`http://${printerIp}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId, stlUrl }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    await db.update(scans).set({
      printStatus: 'error',
      printerIp,
      printError: error instanceof Error ? error.message : 'Erro ao enviar para impressora',
      updatedAt: new Date(),
    }).where(and(eq(scans.id, scanId), eq(scans.tenantId, tenantId)));
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Falha no envio para impressora' });
  }

  await changePrintStatus(tenantId, { scanId, status: 'sent', printerIp }, userId);
  logger.info({ action: 'scan.print.send', tenantId, scanId, printerIp, userId }, 'Envio para impressora executado');
}

export const __testOnly = {
  withDate,
};
