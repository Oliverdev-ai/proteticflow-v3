import { z } from 'zod';
import { router, tenantProcedure, adminProcedure, licensedProcedure } from '../../trpc/trpc.js';
import {
  createJobSchema,
  updateJobSchema,
  changeStatusSchema,
  listJobsSchema,
  kanbanFiltersSchema,
  moveKanbanSchema,
  createJobStageSchema,
  uploadPhotoSchema,
  createOsBlockSchema,
} from '@proteticflow/shared';
import * as jobService from './service.js';
import * as osBlockService from './os-blocks.service.js';

export const jobRouter = router({
  // ── CRUD ────────────────────────────────────────────────────────────────────
  // licensedProcedure garante AP-06: limites de plano verificados automaticamente
  create: licensedProcedure
    .input(createJobSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.createJob(ctx.tenantId!, input, ctx.user!.id);
    }),

  list: tenantProcedure
    .input(listJobsSchema)
    .query(async ({ input, ctx }) => {
      return jobService.listJobs(ctx.tenantId!, input);
    }),

  get: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return jobService.getJob(ctx.tenantId!, input.id);
    }),

  update: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(updateJobSchema))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return jobService.updateJob(ctx.tenantId!, id, data, ctx.user!.id);
    }),

  changeStatus: tenantProcedure
    .input(changeStatusSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.changeStatus(ctx.tenantId!, input, ctx.user!.id);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await jobService.deleteJob(ctx.tenantId!, input.id, ctx.user!.id);
      return { success: true };
    }),

  // ── Logs ────────────────────────────────────────────────────────────────────
  getLogs: tenantProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return jobService.getLogs(ctx.tenantId!, input.jobId);
    }),

  // ── Fotos ────────────────────────────────────────────────────────────────────
  listPhotos: tenantProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return jobService.listPhotos(ctx.tenantId!, input.jobId);
    }),

  uploadPhoto: tenantProcedure
    .input(uploadPhotoSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.uploadPhoto(ctx.tenantId!, input, ctx.user!.id);
    }),

  deletePhoto: adminProcedure
    .input(z.object({ photoId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await jobService.deletePhoto(ctx.tenantId!, input.photoId);
      return { success: true };
    }),

  // ── Etapas ───────────────────────────────────────────────────────────────────
  listStages: tenantProcedure
    .query(async ({ ctx }) => {
      return jobService.listStages(ctx.tenantId!);
    }),

  createStage: adminProcedure
    .input(createJobStageSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.createStage(ctx.tenantId!, input);
    }),

  updateStage: adminProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(createJobStageSchema.partial()))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return jobService.updateStage(
        ctx.tenantId!,
        id,
        Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
      );
    }),

  deleteStage: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await jobService.deleteStage(ctx.tenantId!, input.id);
      return { success: true };
    }),

  seedDefaultStages: tenantProcedure
    .mutation(async ({ ctx }) => {
      await jobService.seedDefaultStages(ctx.tenantId!);
      return { success: true };
    }),

  // ── PDF ─────────────────────────────────────────────────────────────────────
  // Retorna base64 do PDF (não é possível retornar Buffer via tRPC JSON)
  generatePdf: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const buffer = await jobService.generatePdf(ctx.tenantId!, input.id);
      return { pdfBase64: buffer.toString('base64') };
    }),

  // ── Kanban ───────────────────────────────────────────────────────────────────
  getBoard: tenantProcedure
    .input(kanbanFiltersSchema)
    .query(async ({ input, ctx }) => {
      return jobService.getKanbanBoard(ctx.tenantId!, input);
    }),

  moveCard: tenantProcedure
    .input(moveKanbanSchema)
    .mutation(async ({ input, ctx }) => {
      await jobService.moveKanban(ctx.tenantId!, input.jobId, input.newStatus, ctx.user!.id);
      return { success: true };
    }),

  assignTech: tenantProcedure
    .input(z.object({ jobId: z.number().int().positive(), employeeId: z.number().int().positive().nullable() }))
    .mutation(async ({ input, ctx }) => {
      await jobService.assignTechnician(ctx.tenantId!, input.jobId, input.employeeId, ctx.user!.id);
      return { success: true };
    }),

  getMetrics: tenantProcedure
    .query(async ({ ctx }) => {
      return jobService.getKanbanMetrics(ctx.tenantId!);
    }),

  // ── OS Blocks ──────────────────────────────────────────────────────────────────
  createOsBlock: adminProcedure
    .input(createOsBlockSchema)
    .mutation(async ({ input, ctx }) => {
      return osBlockService.createOsBlock(ctx.tenantId!, input);
    }),

  listOsBlocks: tenantProcedure
    .input(z.object({ clientId: z.number().int().positive().optional() }))
    .query(async ({ input, ctx }) => {
      return osBlockService.listOsBlocks(ctx.tenantId!, input.clientId);
    }),

  deleteOsBlock: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await osBlockService.deleteOsBlock(ctx.tenantId!, input.id);
      return { success: true };
    }),

  resolveClientByOsNumber: tenantProcedure
    .input(z.object({ osNumber: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return osBlockService.resolveClientByOsNumber(ctx.tenantId!, input.osNumber);
    }),
});
