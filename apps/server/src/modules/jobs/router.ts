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
  suspendJobSchema,
  unsuspendJobSchema,
  markProofSchema,
  returnProofSchema,
  createReworkSchema,
  toggleUrgentSchema,
} from '@proteticflow/shared';
import * as jobService from './service.js';
import * as osBlockService from './os-blocks.service.js';

const jobStatusSchema = z.enum([
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'rework_in_progress',
  'suspended',
  'delivered',
  'cancelled',
] as const);

const listJobsPageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  statuses: z.array(jobStatusSchema).optional(),
  clientId: z.number().int().positive().optional(),
  deadlineFrom: z.string().datetime().optional(),
  deadlineTo: z.string().datetime().optional(),
  search: z.string().max(160).optional(),
  orderBy: z.enum(['deadline', 'createdAt']).default('deadline'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const presignedUploadSchema = z.object({
  jobId: z.number().int().positive(),
  filename: z.string().min(1).max(180),
  contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

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

  listPage: tenantProcedure
    .input(listJobsPageSchema)
    .query(async ({ input, ctx }) => {
      const { deadlineFrom, deadlineTo, ...filters } = input;
      return jobService.listJobsPage(ctx.tenantId!, {
        ...filters,
        ...(deadlineFrom ? { deadlineFrom: new Date(deadlineFrom) } : {}),
        ...(deadlineTo ? { deadlineTo: new Date(deadlineTo) } : {}),
      });
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

  suspend: tenantProcedure
    .input(suspendJobSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.suspendJob(ctx.tenantId!, input, ctx.user!.id);
    }),

  unsuspend: tenantProcedure
    .input(unsuspendJobSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.unsuspendJob(ctx.tenantId!, input, ctx.user!.id);
    }),

  markAsProof: tenantProcedure
    .input(markProofSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.markJobAsProof(ctx.tenantId!, input, ctx.user!.id);
    }),

  returnProof: tenantProcedure
    .input(returnProofSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.returnJobProof(ctx.tenantId!, input, ctx.user!.id);
    }),

  createRework: tenantProcedure
    .input(createReworkSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.createReworkJob(ctx.tenantId!, input, ctx.user!.id);
    }),

  toggleUrgent: tenantProcedure
    .input(toggleUrgentSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.toggleJobUrgent(ctx.tenantId!, input, ctx.user!.id);
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

  listTimeline: tenantProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      cursor: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      return jobService.listTimeline(ctx.tenantId!, input);
    }),

  addNote: tenantProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      text: z.string().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      return jobService.addNote(ctx.tenantId!, input.jobId, input.text, ctx.user!.id);
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

  getPresignedUploadUrl: tenantProcedure
    .input(presignedUploadSchema)
    .mutation(async ({ input, ctx }) => {
      return jobService.getPresignedUploadUrl(ctx.tenantId!, input);
    }),

  confirmUpload: tenantProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      key: z.string().min(1).max(512),
      filename: z.string().min(1).max(180),
      description: z.string().max(512).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return jobService.confirmUpload(ctx.tenantId!, input, ctx.user!.id);
    }),

  getPresignedDownloadUrl: tenantProcedure
    .input(z.object({ photoId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return jobService.getPresignedDownloadUrl(ctx.tenantId!, input.photoId);
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

  listSuspended: tenantProcedure
    .query(async ({ ctx }) => {
      return jobService.listSuspendedJobs(ctx.tenantId!);
    }),

  moveCard: tenantProcedure
    .input(moveKanbanSchema)
    .mutation(async ({ input, ctx }) => {
      await jobService.moveKanban(ctx.tenantId!, input.jobId, input.newStatus, ctx.user!.id);
      return { success: true };
    }),

  updateStatus: tenantProcedure
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
