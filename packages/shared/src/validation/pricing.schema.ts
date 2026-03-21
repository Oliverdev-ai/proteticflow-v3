import { z } from 'zod';

export const createPricingTableSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export const updatePricingTableSchema = createPricingTableSchema.partial();

export const createPriceItemSchema = z.object({
  pricingTableId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  code: z.string().max(64).optional(),
  description: z.string().optional(),
  category: z.string().min(1).max(128),
  material: z.string().max(255).optional(),
  estimatedDays: z.number().int().min(1).default(5),
  priceCents: z.number().int().min(0, 'Preço não pode ser negativo'),
});

export const updatePriceItemSchema = createPriceItemSchema.partial().omit({ pricingTableId: true });

export const bulkAdjustSchema = z.object({
  pricingTableId: z.number().int().positive(),
  adjustmentPercent: z.number().min(-99.99).max(999.99),
});

export const listPriceItemsSchema = z.object({
  pricingTableId: z.number().int().positive(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const listPricingTablesSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
