import { randomBytes, createHash } from 'crypto';
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../../db/index.js';
import { portalTokens } from '../../db/schema/portal.js';
import { clients } from '../../db/schema/clients.js';
import { jobs, jobLogs, jobPhotos } from '../../db/schema/jobs.js';
import { labSettings } from '../../db/schema/lab-settings.js';
import { tenants } from '../../db/schema/tenants.js';
import type {
  PublicPortalJob,
  PublicPortalPhoto,
  PublicPortalSnapshot,
  PublicPortalTimelineItem,
} from '@proteticflow/shared';

type CreatePortalTokenInput = {
  clientId: number;
  expiresInDays: number;
};

function hashToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

function pickPublicJob(job: typeof jobs.$inferSelect): PublicPortalJob {
  return {
    id: job.id,
    code: job.code,
    patientName: job.patientName ?? null,
    prothesisType: job.prothesisType ?? null,
    material: job.material ?? null,
    color: job.color ?? null,
    status: job.status,
    deadline: job.deadline.toISOString(),
    deliveredAt: job.deliveredAt ? job.deliveredAt.toISOString() : null,
  };
}

function pickPublicTimeline(log: typeof jobLogs.$inferSelect): PublicPortalTimelineItem {
  return {
    id: log.id,
    toStatus: log.toStatus,
    notes: log.notes ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

function pickPublicPhoto(photo: typeof jobPhotos.$inferSelect): PublicPortalPhoto {
  return {
    id: photo.id,
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl ?? null,
    description: photo.description ?? null,
    createdAt: photo.createdAt.toISOString(),
  };
}

export async function createPortalToken(tenantId: number, input: CreatePortalTokenInput, userId: number) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(
      eq(clients.tenantId, tenantId),
      eq(clients.id, input.clientId),
      isNull(clients.deletedAt),
    ));

  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado' });
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const [created] = await db
    .insert(portalTokens)
    .values({
      tenantId,
      clientId: input.clientId,
      tokenHash,
      expiresAt,
      createdBy: userId,
    })
    .returning();

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar token do portal' });
  }

  return {
    id: created.id,
    token,
    expiresAt: created.expiresAt.toISOString(),
    portalUrlPath: `/portal/${token}`,
  };
}

export async function revokePortalToken(tenantId: number, tokenId: number) {
  const [updated] = await db
    .update(portalTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(portalTokens.tenantId, tenantId), eq(portalTokens.id, tokenId)))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Token nao encontrado' });
  }

  return { success: true };
}

export async function listPortalTokensByClient(tenantId: number, clientId: number) {
  const rows = await db
    .select()
    .from(portalTokens)
    .where(and(
      eq(portalTokens.tenantId, tenantId),
      eq(portalTokens.clientId, clientId),
    ))
    .orderBy(desc(portalTokens.createdAt));

  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    lastAccessAt: row.lastAccessAt ? row.lastAccessAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    isActive: !row.revokedAt && row.expiresAt > new Date(),
  }));
}

export async function sendPortalLink(tenantId: number, tokenId: number, email: string) {
  const [tokenRow] = await db
    .select()
    .from(portalTokens)
    .where(and(
      eq(portalTokens.tenantId, tenantId),
      eq(portalTokens.id, tokenId),
    ));

  if (!tokenRow) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Token nao encontrado' });
  }

  if (tokenRow.revokedAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token revogado' });
  }

  if (tokenRow.expiresAt <= new Date()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token expirado' });
  }

  logger.info(
    {
      action: 'portal.link.send',
      tenantId,
      tokenId,
      email,
      portalPath: '/portal/<token>',
    },
    'Envio de link do portal solicitado (stub de email)',
  );

  return { success: true };
}

export async function buildPublicJobTimeline(tenantId: number, clientId: number) {
  const clientJobs = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      eq(jobs.clientId, clientId),
      isNull(jobs.deletedAt),
    ));

  const jobIds = clientJobs.map((job) => job.id);
  if (jobIds.length === 0) return {};

  const logs = await db
    .select()
    .from(jobLogs)
    .where(and(
      eq(jobLogs.tenantId, tenantId),
      inArray(jobLogs.jobId, jobIds),
    ))
    .orderBy(desc(jobLogs.createdAt));

  const timelineByJob: Record<number, PublicPortalTimelineItem[]> = {};
  for (const log of logs) {
    if (!timelineByJob[log.jobId]) timelineByJob[log.jobId] = [];
    timelineByJob[log.jobId].push(pickPublicTimeline(log));
  }

  return timelineByJob;
}

export async function getPublicJobPhotos(tenantId: number, jobId: number) {
  const photos = await db
    .select()
    .from(jobPhotos)
    .where(and(
      eq(jobPhotos.tenantId, tenantId),
      eq(jobPhotos.jobId, jobId),
    ))
    .orderBy(desc(jobPhotos.createdAt));

  return photos.map(pickPublicPhoto);
}

export async function getPortalSnapshotByToken(token: string): Promise<PublicPortalSnapshot> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [portalToken] = await db
    .select()
    .from(portalTokens)
    .where(and(
      eq(portalTokens.tokenHash, tokenHash),
      isNull(portalTokens.revokedAt),
      gt(portalTokens.expiresAt, now),
    ));

  if (!portalToken) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Token invalido ou expirado' });
  }

  await db
    .update(portalTokens)
    .set({ lastAccessAt: now })
    .where(eq(portalTokens.id, portalToken.id));

  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(
      eq(clients.id, portalToken.clientId),
      eq(clients.tenantId, portalToken.tenantId),
      isNull(clients.deletedAt),
    ));

  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado para este token' });
  }

  const [tenant] = await db
    .select({ name: tenants.name, logoUrl: tenants.logoUrl })
    .from(tenants)
    .where(eq(tenants.id, portalToken.tenantId));

  const [settings] = await db
    .select({ logoUrl: labSettings.logoUrl, primaryColor: labSettings.primaryColor })
    .from(labSettings)
    .where(eq(labSettings.tenantId, portalToken.tenantId));

  const clientJobs = await db
    .select()
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, portalToken.tenantId),
      eq(jobs.clientId, client.id),
      isNull(jobs.deletedAt),
    ))
    .orderBy(desc(jobs.createdAt));

  const jobsPublic = clientJobs.map(pickPublicJob);
  const timelineByJob = await buildPublicJobTimeline(portalToken.tenantId, client.id);
  const photosByJob: Record<number, PublicPortalPhoto[]> = {};

  for (const job of clientJobs) {
    photosByJob[job.id] = await getPublicJobPhotos(portalToken.tenantId, job.id);
  }

  return {
    tenantName: tenant?.name || 'Laboratorio',
    tenantLogoUrl: settings?.logoUrl ?? tenant?.logoUrl ?? null,
    tenantPrimaryColor: settings?.primaryColor ?? null,
    clientName: client.name,
    jobs: jobsPublic,
    timelineByJob,
    photosByJob,
  };
}

export const __testOnly = {
  hashToken,
  pickPublicJob,
};
