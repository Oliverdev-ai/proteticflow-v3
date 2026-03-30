import { z } from 'zod';

export const listAuditLogsSchema = z.object({
  entityType: z.string().max(64).optional(),
  action: z.string().max(128).optional(),
  userId: z.number().int().positive().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export const blockMemberSchema = z.object({
  userId: z.number().int().positive(),
  reason: z.string().min(3, 'Motivo obrigatório').max(500),
});
