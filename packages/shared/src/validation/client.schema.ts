import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255),
  clinic: z.string().max(255).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(32).optional(),
  phone2: z.string().max(32).optional(),
  documentType: z.enum(['cpf', 'cnpj']).optional(),
  document: z.string().max(20).optional(),
  contactPerson: z.string().max(255).optional(),
  // Endereço
  street: z.string().max(255).optional(),
  addressNumber: z.string().max(20).optional(),
  complement: z.string().max(128).optional(),
  neighborhood: z.string().max(128).optional(),
  city: z.string().max(128).optional(),
  state: z.string().length(2).optional(),
  zipCode: z.string().max(10).optional(),
  // Técnicas
  technicalPreferences: z.string().optional(),
  // Preço (PAD-05)
  priceAdjustmentPercent: z.number().min(-100).max(100).default(0),
  pricingTableId: z.number().int().positive().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const listClientsSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const clientIdSchema = z.object({
  id: z.number().int().positive(),
});
