import { z } from 'zod';

export const createPurchaseSchema = z.object({
  supplierId: z.number().int().positive({ message: 'Fornecedor é obrigatório' }),
  notes: z.string().optional(),
  items: z.array(z.object({
    materialId: z.number().int().positive(),
    quantity: z.number().positive({ message: 'Quantidade deve ser positiva' }),
    unitPriceCents: z.number().int().min(1, { message: 'Preço deve ser positivo' }),
  })).min(1, 'Compra deve ter pelo menos 1 item'),
});

export const updatePurchaseSchema = z.object({
  supplierId: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const listPurchasesSchema = z.object({
  status: z.enum(['draft', 'sent', 'received', 'cancelled']).optional(),
  supplierId: z.number().int().positive().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const receivePurchaseSchema = z.object({
  id: z.number().int().positive(),
  dueDate: z.string().optional(),
});

export const cancelPurchaseSchema = z.object({
  id: z.number().int().positive(),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type ListPurchasesInput = z.infer<typeof listPurchasesSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
