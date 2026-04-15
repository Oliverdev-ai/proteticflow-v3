import { z } from 'zod';

// ─── Categorias (09.02, 09.17) ────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  color: z.string().max(32).default('slate'),
});
export const updateCategorySchema = createCategorySchema.partial();

// ─── Fornecedores (09.03, 09.16) ─────────────────────────────────────────────

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  cnpj: z.string().max(18).optional(),
  contact: z.string().max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(32).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
export const updateSupplierSchema = createSupplierSchema.partial();

export const listSuppliersSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ─── Materiais (09.01) ───────────────────────────────────────────────────────

export const createMaterialSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(64).optional(),
  barcode: z.string().max(128).optional(),
  description: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  supplierId: z.number().int().positive().optional(),
  unit: z.string().max(32).default('un'),
  minStock: z.number().min(0).default(0),
  initialQuantity: z.number().min(0).default(0),
  unitCostCents: z.number().int().min(0).default(0),
  maxStock: z.number().min(0).optional(),
  notes: z.string().optional(),
});
export const updateMaterialSchema = createMaterialSchema.partial();

export const listMaterialsSchema = z.object({
  search: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  belowMinimum: z.boolean().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ─── Movimentações (09.04) ───────────────────────────────────────────────────

export const createMovementSchema = z.object({
  materialId: z.number().int().positive(),
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  unitCostCents: z.number().int().min(0).optional(),
  reason: z.string().max(512).optional(),
  jobId: z.number().int().positive().optional(),
  supplierId: z.number().int().positive().optional(),
  invoiceNumber: z.string().max(128).optional(),
  purchaseOrderId: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const listMovementsSchema = z.object({
  materialId: z.number().int().positive().optional(),
  type: z.enum(['in', 'out', 'adjustment']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  cursor: z.number().int().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// ─── Ordens de Compra (09.07) ────────────────────────────────────────────────

export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    materialId: z.number().int().positive(),
    quantity: z.number().positive(),
    unitPriceCents: z.number().int().min(0),
  })).min(1, 'OC deve ter pelo menos 1 item'),
});

export const updatePurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const changePurchaseOrderStatusSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(['draft', 'sent', 'received', 'cancelled']),
});

export const listPurchaseOrdersSchema = z.object({
  status: z.enum(['draft', 'sent', 'received', 'cancelled']).optional(),
  supplierId: z.number().int().positive().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Types
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type ListSuppliersInput = z.infer<typeof listSuppliersSchema>;
export type CreateMaterialInput = z.input<typeof createMaterialSchema>;
export type ListMaterialsInput = z.infer<typeof listMaterialsSchema>;
export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type ListMovementsInput = z.infer<typeof listMovementsSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ListPurchaseOrdersInput = z.infer<typeof listPurchaseOrdersSchema>;
export type ChangePurchaseOrderStatusInput = z.infer<typeof changePurchaseOrderStatusSchema>;
