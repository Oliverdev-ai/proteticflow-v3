import { z } from 'zod';

export const generateBoletoSchema = z.object({
  arId: z.number().int().positive(),
});

export const generateBoletoManualSchema = z.object({
  clientId: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  dueDate: z.string().datetime(),
  description: z.string().max(255).optional(),
});

export const listBoletosSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled', 'refunded']).optional(),
  clientId: z.number().int().positive().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.number().int().positive().optional(),
});

export const cancelBoletoSchema = z.object({
  boletoId: z.number().int().positive(),
  reason: z.string().min(1).max(255).optional(),
});

export const emitNfseSchema = z.object({
  arId: z.number().int().positive().optional(),
  closingId: z.number().int().positive().optional(),
  clientId: z.number().int().positive(),
  grossValueCents: z.number().int().positive(),
  serviceName: z.string().min(1).max(255).optional(),
  serviceCode: z.string().min(1).max(16).optional(),
});

export const emitNfseInBatchSchema = z.object({
  closingId: z.number().int().positive(),
});

export const cancelNfseSchema = z.object({
  nfseId: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});

export const listNfseSchema = z.object({
  status: z.enum(['draft', 'pending', 'issued', 'cancelled', 'error']).optional(),
  clientId: z.number().int().positive().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.number().int().positive().optional(),
});

export const upsertFiscalSettingsSchema = z.object({
  municipalRegistration: z.string().max(32).optional(),
  taxRegime: z.enum(['simples', 'lucro_presumido', 'lucro_real']).optional(),
  defaultServiceCode: z.string().max(16).optional(),
  defaultServiceName: z.string().max(255).optional(),
  issqnRatePercent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  asaasApiKey: z.string().max(128).optional(),
  asaasSandbox: z.boolean().optional(),
  focusApiToken: z.string().max(128).optional(),
  focusSandbox: z.boolean().optional(),
  cityCode: z.string().max(16).optional(),
});
