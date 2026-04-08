import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(2).max(255),
  cpf: z.string().max(14).optional().nullable(),
  rg: z.string().max(20).optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().max(32).optional().nullable(),
  phone2: z.string().max(32).optional().nullable(),
  // Endereço
  street: z.string().max(255).optional().nullable(),
  addressNumber: z.string().max(20).optional().nullable(),
  complement: z.string().max(128).optional().nullable(),
  neighborhood: z.string().max(128).optional().nullable(),
  city: z.string().max(128).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
  // Vínculo
  admissionDate: z.string().datetime().optional().nullable(),
  position: z.string().max(128).optional().nullable(),
  department: z.string().max(128).optional().nullable(),
  type: z.enum(['protesista', 'auxiliar', 'recepcionista', 'gerente', 'proprietario', 'outro']).default('auxiliar'),
  contractType: z.enum(['clt', 'pj_mei', 'freelancer', 'estagiario', 'autonomo', 'temporario']).default('clt'),
  // Remuneração
  baseSalaryCents: z.number().int().min(0).default(0),
  transportAllowanceCents: z.number().int().min(0).default(0),
  mealAllowanceCents: z.number().int().min(0).default(0),
  healthInsuranceCents: z.number().int().min(0).default(0),
  // Banco
  bankName: z.string().max(128).optional().nullable(),
  bankAgency: z.string().max(20).optional().nullable(),
  bankAccount: z.string().max(30).optional().nullable(),
  // Comissão
  defaultCommissionPercent: z.number().min(0).max(100).default(0),
  // Vínculo user
  userId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['protesista', 'auxiliar', 'recepcionista', 'gerente', 'proprietario', 'outro']).optional(),
  contractType: z.enum(['clt', 'pj_mei', 'freelancer', 'estagiario', 'autonomo', 'temporario']).optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const createSkillSchema = z.object({
  employeeId: z.number().int().positive(),
  name: z.string().min(1).max(128),
  level: z.number().int().min(1).max(4),
  description: z.string().optional().nullable(),
});

export const createAssignmentSchema = z.object({
  jobId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
  task: z.string().max(255).optional().nullable(),
  commissionOverridePercent: z.number().min(0).max(100).optional().nullable(),
});

export const createCommissionPaymentSchema = z.object({
  employeeId: z.number().int().positive(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  paymentMethod: z.string().max(64).optional().nullable(),
  reference: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const productionReportSchema = z.object({
  employeeId: z.number().int().positive().optional().nullable(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});
