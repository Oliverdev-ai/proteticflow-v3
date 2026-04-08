import { z } from 'zod';

export const createOsBlockSchema = z.object({
  clientId: z.number().int().positive(),
  startNumber: z.number().int().positive(),
  endNumber: z.number().int().positive(),
  label: z.string().max(64).optional(),
}).refine(d => d.endNumber > d.startNumber, { 
  message: 'Número final deve ser maior que inicial',
  path: ['endNumber']
});

export type CreateOsBlockInput = z.infer<typeof createOsBlockSchema>;
