import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { createContext } from '../trpc/context.js';
import * as jobService from '../modules/jobs/service.js';

const exportQuerySchema = z.object({
  status: z.string().optional(),
  clientId: z.coerce.number().int().positive().optional(),
  deadlineFrom: z.string().datetime().optional(),
  deadlineTo: z.string().datetime().optional(),
  search: z.string().max(160).optional(),
});

const allowedStatuses = new Set([
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'rework_in_progress',
  'suspended',
  'delivered',
  'cancelled',
] as const);

export const jobsExportRouter = Router();

jobsExportRouter.get('/api/trabalhos/export.csv', async (req, res) => {
  const ctx = await createContext(db)({ req, res });
  if (!ctx.user || !ctx.tenantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedResult = exportQuerySchema.safeParse(req.query);
  if (!parsedResult.success) {
    res.status(400).json({ error: 'Invalid export filters' });
    return;
  }
  const parsed = parsedResult.data;
  const statuses = parsed.status
    ?.split(',')
    .filter((status): status is NonNullable<jobService.ListJobsPageInput['statuses']>[number] =>
      allowedStatuses.has(status as NonNullable<jobService.ListJobsPageInput['statuses']>[number]),
    );

  const filters = {
    ...(statuses && statuses.length > 0 ? { statuses } : {}),
    ...(parsed.clientId ? { clientId: parsed.clientId } : {}),
    ...(parsed.deadlineFrom ? { deadlineFrom: new Date(parsed.deadlineFrom) } : {}),
    ...(parsed.deadlineTo ? { deadlineTo: new Date(parsed.deadlineTo) } : {}),
    ...(parsed.search ? { search: parsed.search } : {}),
    orderBy: 'deadline',
    order: 'asc',
  } satisfies Omit<jobService.ListJobsPageInput, 'page' | 'pageSize'>;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="trabalhos.csv"');
  res.status(200);
  for await (const chunk of jobService.streamJobsCsv(ctx.tenantId, filters)) {
    res.write(chunk);
  }
  res.end();
});
