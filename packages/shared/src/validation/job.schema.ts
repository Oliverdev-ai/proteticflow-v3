import { z } from 'zod';

const JOB_STATUS_VALUES = ['pending', 'in_progress', 'quality_check', 'ready', 'completed_with_rework', 'delivered', 'cancelled'] as const;
const JOB_SUBTYPE_VALUES = ['standard', 'proof', 'rework'] as const;

export const createJobSchema = z.object({
  clientId: z.number().int().positive().optional(),
  osNumber: z.number().int().positive().optional(),
  jobSubType: z.enum(JOB_SUBTYPE_VALUES).optional(),
  isUrgent: z.boolean().optional(),
  proofDueDate: z.string().datetime().optional(),
  reworkReason: z.string().min(3).optional(),
  reworkParentId: z.number().int().positive().optional(),
  patientName: z.string().max(255).optional(),
  prothesisType: z.string().max(128).optional(),
  material: z.string().max(128).optional(),
  color: z.string().max(64).optional(),
  instructions: z.string().optional(),
  deadline: z.string().datetime({ message: 'Prazo inválido (ISO 8601 esperado)' }),
  assignedTo: z.number().int().positive().optional(),
  notes: z.string().optional(),
  // Itens da OS (AP-02: preço congelado)
  items: z.array(z.object({
    priceItemId: z.number().int().positive().optional(),
    serviceNameSnapshot: z.string().min(1, 'Nome do serviço obrigatório').max(255),
    quantity: z.number().int().min(1, 'Quantidade mínima 1'),
    unitPriceCents: z.number().int().min(0, 'Preço não pode ser negativo'),
    adjustmentPercent: z.number().min(-100).max(100).default(0),
  })).min(1, 'OS deve ter pelo menos 1 item'),
}).refine(d => d.clientId || d.osNumber, {
  message: 'Cliente ou número de OS é obrigatório',
  path: ['clientId']
}).superRefine((data, ctx) => {
  if (data.jobSubType === 'proof' && !data.proofDueDate) {
    ctx.addIssue({
      code: 'custom',
      message: 'Prazo da prova é obrigatório para OS de prova',
      path: ['proofDueDate'],
    });
  }
  if (data.jobSubType === 'rework' && !data.reworkReason) {
    ctx.addIssue({
      code: 'custom',
      message: 'Motivo da remoldagem é obrigatório',
      path: ['reworkReason'],
    });
  }
});

export const updateJobSchema = z.object({
  jobSubType: z.enum(JOB_SUBTYPE_VALUES).optional(),
  isUrgent: z.boolean().optional(),
  proofDueDate: z.string().datetime().nullable().optional(),
  proofReturnedAt: z.string().datetime().nullable().optional(),
  reworkReason: z.string().min(3).nullable().optional(),
  reworkParentId: z.number().int().positive().nullable().optional(),
  patientName: z.string().max(255).optional(),
  prothesisType: z.string().max(128).optional(),
  material: z.string().max(128).optional(),
  color: z.string().max(64).optional(),
  instructions: z.string().optional(),
  deadline: z.string().datetime().optional(),
  assignedTo: z.number().int().positive().nullable().optional(),
  notes: z.string().optional(),
});

export const changeStatusSchema = z.object({
  jobId: z.number().int().positive(),
  newStatus: z.enum(JOB_STATUS_VALUES),
  notes: z.string().optional(),
  cancelReason: z.string().min(1).optional(),
}).refine(
  (d) => d.newStatus !== 'cancelled' || !!d.cancelReason,
  { message: 'Motivo de cancelamento obrigatório', path: ['cancelReason'] }
);

export const listJobsSchema = z.object({
  search: z.string().optional(),
  status: z.enum(JOB_STATUS_VALUES).optional(),
  clientId: z.number().int().positive().optional(),
  overdue: z.boolean().optional(),
  cursor: z.number().int().optional(), // PAD-06: cursor-based pagination
  limit: z.number().int().min(1).max(100).default(20),
});

export const kanbanFiltersSchema = z.object({
  clientId: z.number().int().positive().optional(),
  assignedTo: z.number().int().positive().optional(),
  overdue: z.boolean().optional(),
});

export const moveKanbanSchema = z.object({
  jobId: z.number().int().positive(),
  newStatus: z.enum(['pending', 'in_progress', 'quality_check', 'ready', 'delivered'] as const),
});

export const suspendJobSchema = z.object({
  jobId: z.number().int().positive(),
  reason: z.string().min(3),
});

export const unsuspendJobSchema = z.object({
  jobId: z.number().int().positive(),
});

export const markProofSchema = z.object({
  jobId: z.number().int().positive(),
  proofDueDate: z.string().datetime(),
});

export const returnProofSchema = z.object({
  jobId: z.number().int().positive(),
});

export const toggleUrgentSchema = z.object({
  jobId: z.number().int().positive(),
  isUrgent: z.boolean(),
});

export const createReworkSchema = z.object({
  originalJobId: z.number().int().positive(),
  reason: z.string().min(3),
  deadline: z.string().datetime(),
  patientName: z.string().max(255).optional(),
  prothesisType: z.string().max(128).optional(),
  material: z.string().max(128).optional(),
  color: z.string().max(64).optional(),
  instructions: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.number().int().positive().nullable().optional(),
});

export const createJobStageSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0),
});

export const uploadPhotoSchema = z.object({
  jobId: z.number().int().positive(),
  stageId: z.number().int().positive().optional(),
  description: z.string().max(512).optional(),
  // base64-encoded file for MVP (simpler than presigned URL flow)
  fileBase64: z.string().min(1),
  mimeType: z.string().min(1),
  filename: z.string().min(1),
});
