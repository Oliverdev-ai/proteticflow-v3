import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255),
  cnpj: z.string().max(18).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().max(128).optional(),
  state: z.string().length(2).optional(),
});

export const updateTenantSchema = createTenantSchema.partial();

export const inviteMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['superadmin', 'gerente', 'producao', 'recepcao', 'contabil']),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.number().int().positive(),
  role: z.enum(['superadmin', 'gerente', 'producao', 'recepcao', 'contabil']),
});

export const removeMemberSchema = z.object({
  memberId: z.number().int().positive(),
});

export const switchTenantSchema = z.object({
  tenantId: z.number().int().positive(),
});
