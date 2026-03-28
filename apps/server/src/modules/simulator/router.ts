import { router, tenantProcedure, adminProcedure, licensedProcedure } from '../../trpc/trpc.js';
import {
  createSimulationDraftSchema,
  updateSimulationDraftSchema,
  previewSimulationCalculationSchema,
  compareSimulationTablesSchema,
  listSimulationsSchema,
  getSimulationSchema,
  sendSimulationBudgetEmailSchema,
  approveSimulationAndCreateJobSchema,
} from '@proteticflow/shared';
import * as simulatorService from './service.js';

export const simulatorRouter = router({
  createDraft: licensedProcedure
    .input(createSimulationDraftSchema)
    .mutation(({ ctx, input }) => simulatorService.createDraft(ctx.tenantId!, input, ctx.user!.id)),

  updateDraft: licensedProcedure
    .input(updateSimulationDraftSchema)
    .mutation(({ ctx, input }) => simulatorService.updateDraft(ctx.tenantId!, input)),

  previewCalculation: tenantProcedure
    .input(previewSimulationCalculationSchema)
    .query(({ ctx, input }) => simulatorService.previewCalculation(ctx.tenantId!, input)),

  compareTables: tenantProcedure
    .input(compareSimulationTablesSchema)
    .query(({ ctx, input }) => simulatorService.compareTablesByInput(ctx.tenantId!, input)),

  listSimulations: tenantProcedure
    .input(listSimulationsSchema)
    .query(({ ctx, input }) => simulatorService.listSimulations(ctx.tenantId!, input)),

  getSimulation: tenantProcedure
    .input(getSimulationSchema)
    .query(({ ctx, input }) => simulatorService.getSimulation(ctx.tenantId!, input.simulationId)),

  sendBudgetEmail: adminProcedure
    .input(sendSimulationBudgetEmailSchema)
    .mutation(({ ctx, input }) => simulatorService.sendBudgetEmail(ctx.tenantId!, input.simulationId, input.email)),

  approveAndCreateJob: adminProcedure
    .input(approveSimulationAndCreateJobSchema)
    .mutation(({ ctx, input }) => simulatorService.approveAndCreateJob(ctx.tenantId!, input, ctx.user!.id)),
});
