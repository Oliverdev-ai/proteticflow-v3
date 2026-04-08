import { z } from 'zod';

export const createScanSchema = z.object({
  jobId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  scannerType: z.enum(['itero', 'medit', '3shape', 'carestream', 'outro']).default('outro'),
  notes: z.string().optional(),
});

export const updateScanSchema = z.object({
  jobId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  scannerType: z.enum(['itero', 'medit', '3shape', 'carestream', 'outro']).optional(),
  notes: z.string().optional(),
});

export const changePrintStatusSchema = z.object({
  scanId: z.number().int().positive(),
  status: z.enum(['waiting', 'sent', 'printing', 'completed', 'error']),
  printerIp: z.string().max(45).optional(),
  printError: z.string().optional(),
});

export const listScansSchema = z.object({
  jobId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  scannerType: z.enum(['itero', 'medit', '3shape', 'carestream', 'outro']).optional(),
  printStatus: z.enum(['waiting', 'sent', 'printing', 'completed', 'error']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  orphanOnly: z.boolean().optional(),
  hasFile: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

