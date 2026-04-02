import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

export const createClientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255),
  clinic: z.preprocess(emptyStringToUndefined, z.string().max(255).optional()),
  email: z.preprocess(emptyStringToUndefined, z.string().email('Email invalido').optional()),
  phone: z.preprocess(emptyStringToUndefined, z.string().max(32).optional()),
  phone2: z.preprocess(emptyStringToUndefined, z.string().max(32).optional()),
  documentType: z.preprocess(emptyStringToUndefined, z.enum(['cpf', 'cnpj']).optional()),
  document: z.preprocess(emptyStringToUndefined, z.string().max(20).optional()),
  contactPerson: z.preprocess(emptyStringToUndefined, z.string().max(255).optional()),
  // Endereco
  street: z.preprocess(emptyStringToUndefined, z.string().max(255).optional()),
  addressNumber: z.preprocess(emptyStringToUndefined, z.string().max(20).optional()),
  complement: z.preprocess(emptyStringToUndefined, z.string().max(128).optional()),
  neighborhood: z.preprocess(emptyStringToUndefined, z.string().max(128).optional()),
  city: z.preprocess(emptyStringToUndefined, z.string().max(128).optional()),
  state: z.preprocess(emptyStringToUndefined, z.string().length(2).optional()),
  zipCode: z.preprocess(emptyStringToUndefined, z.string().max(10).optional()),
  // Tecnicas
  technicalPreferences: z.preprocess(emptyStringToUndefined, z.string().optional()),
  // Preco (PAD-05)
  priceAdjustmentPercent: z.number().min(-100).max(100).default(0),
  pricingTableId: z.preprocess(emptyStringToUndefined, z.number().int().positive().optional()),
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
