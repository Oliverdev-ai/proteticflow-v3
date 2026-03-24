import { z } from 'zod';

export const simulationStatusSchema = z.enum(['draft', 'sent', 'approved', 'rejected']);

export const simulationItemInputSchema = z.object({
  priceItemId: z.number().int().positive().optional().nullable(),
  serviceNameSnapshot: z.string().min(1).max(255).optional(),
  categorySnapshot: z.string().max(128).optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  unitPriceCents: z.number().int().min(0).optional(),
  estimatedUnitCostCents: z.number().int().min(0).optional().default(0),
});

export const createSimulationDraftSchema = z.object({
  clientId: z.number().int().positive(),
  pricingTableId: z.number().int().positive().optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  scenarioDiscountPercent: z.number().min(0).max(100).default(0),
  items: z.array(simulationItemInputSchema).min(1),
});

export const updateSimulationDraftSchema = z.object({
  simulationId: z.number().int().positive(),
  pricingTableId: z.number().int().positive().optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  scenarioDiscountPercent: z.number().min(0).max(100).optional(),
  items: z.array(simulationItemInputSchema).min(1).optional(),
});

export const previewSimulationCalculationSchema = z.object({
  clientId: z.number().int().positive(),
  pricingTableId: z.number().int().positive().optional().nullable(),
  scenarioDiscountPercent: z.number().min(0).max(100).default(0),
  items: z.array(simulationItemInputSchema).min(1),
});

export const compareSimulationTablesSchema = z.object({
  clientId: z.number().int().positive(),
  tableIds: z.array(z.number().int().positive()).min(2).max(5),
  items: z.array(z.object({
    priceItemId: z.number().int().positive().optional().nullable(),
    serviceNameSnapshot: z.string().min(1).max(255).optional(),
    quantity: z.number().int().min(1).max(999),
  })).min(1),
});

export const listSimulationsSchema = z.object({
  clientId: z.number().int().positive().optional(),
  status: simulationStatusSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const getSimulationSchema = z.object({
  simulationId: z.number().int().positive(),
});

export const sendSimulationBudgetEmailSchema = z.object({
  simulationId: z.number().int().positive(),
  email: z.string().email(),
});

export const approveSimulationAndCreateJobSchema = z.object({
  simulationId: z.number().int().positive(),
  deadline: z.string().datetime(),
  patientName: z.string().max(255).optional().nullable(),
  prothesisType: z.string().max(128).optional().nullable(),
  material: z.string().max(128).optional().nullable(),
  color: z.string().max(64).optional().nullable(),
  instructions: z.string().max(4000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  assignedTo: z.number().int().positive().optional().nullable(),
});
