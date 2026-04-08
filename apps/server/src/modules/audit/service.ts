import { and, count, desc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  PLAN_LIMITS,
  type AuditLogEntry,
  type ListAuditLogsInput,
  type TenantUsageSummary,
} from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit.js';
import { tenantMembers, tenants } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import { logger } from '../../logger.js';

type LogAuditInput = {
  tenantId: number;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
};

type TenantUsageAdminRow = {
  id: number;
  name: string;
  plan: string;
  clientCount: number;
  jobCountThisMonth: number;
  userCount: number;
  priceTableCount: number;
  storageUsedMb: number;
  isActive: boolean;
  createdAt: Date;
};

export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    logger.error({ err, action: input.action, tenantId: input.tenantId }, 'Falha ao registrar audit log');
  }
}

export async function listAuditLogs(
  tenantId: number,
  input: ListAuditLogsInput,
): Promise<{ items: AuditLogEntry[]; total: number }> {
  const page = input.page ?? 1;
  const limit = input.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions = [eq(auditLogs.tenantId, tenantId)];
  if (input.entityType) conditions.push(eq(auditLogs.entityType, input.entityType));
  if (input.action) conditions.push(eq(auditLogs.action, input.action));
  if (input.userId) conditions.push(eq(auditLogs.userId, input.userId));

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      oldValue: row.oldValue,
      newValue: row.newValue,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export async function getTenantUsageSummary(tenantId: number): Promise<TenantUsageSummary | null> {
  const [tenant] = await db
    .select({
      plan: tenants.plan,
      clientCount: tenants.clientCount,
      jobCountThisMonth: tenants.jobCountThisMonth,
      userCount: tenants.userCount,
      priceTableCount: tenants.priceTableCount,
      storageUsedMb: tenants.storageUsedMb,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) return null;

  const plan = (tenant.plan in PLAN_LIMITS ? tenant.plan : 'trial') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];

  return {
    tenantId,
    plan,
    clients: { used: tenant.clientCount, limit: limits.clients },
    jobsThisMonth: { used: tenant.jobCountThisMonth, limit: limits.jobsPerMonth },
    users: { used: tenant.userCount, limit: limits.users },
    priceTables: { used: tenant.priceTableCount, limit: limits.priceTables },
    storageMb: { used: tenant.storageUsedMb, limit: limits.storagesMb },
  };
}

export async function blockMember(
  tenantId: number,
  targetUserId: number,
  blockedBy: number,
  reason: string,
): Promise<void> {
  const [updated] = await db
    .update(tenantMembers)
    .set({
      blockedAt: new Date(),
      blockedReason: reason,
      blockedBy,
      updatedAt: new Date(),
    })
    .where(and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.userId, targetUserId),
      eq(tenantMembers.isActive, true),
    ))
    .returning({ id: tenantMembers.id });

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Membro não encontrado' });
  }
}

export async function unblockMember(
  tenantId: number,
  targetUserId: number,
): Promise<void> {
  const [updated] = await db
    .update(tenantMembers)
    .set({
      blockedAt: null,
      blockedReason: null,
      blockedBy: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.userId, targetUserId),
      eq(tenantMembers.isActive, true),
    ))
    .returning({ id: tenantMembers.id });

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Membro não encontrado' });
  }
}

export async function listTenantMembers(tenantId: number) {
  const rows = await db
    .select({
      memberId: tenantMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: tenantMembers.role,
      isActive: tenantMembers.isActive,
      joinedAt: tenantMembers.joinedAt,
      blockedAt: tenantMembers.blockedAt,
      blockedReason: tenantMembers.blockedReason,
      blockedBy: tenantMembers.blockedBy,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.userId, users.id))
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.isActive, true)))
    .orderBy(users.name);

  return rows.map((row) => ({
    memberId: row.memberId,
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    joinedAt: row.joinedAt.toISOString(),
    blockedAt: row.blockedAt ? row.blockedAt.toISOString() : null,
    blockedReason: row.blockedReason,
    blockedBy: row.blockedBy,
  }));
}

export async function listAllTenantsUsage(): Promise<TenantUsageAdminRow[]> {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      plan: tenants.plan,
      clientCount: tenants.clientCount,
      jobCountThisMonth: tenants.jobCountThisMonth,
      userCount: tenants.userCount,
      priceTableCount: tenants.priceTableCount,
      storageUsedMb: tenants.storageUsedMb,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  return rows.map((row) => ({
    ...row,
    plan: row.plan,
  }));
}
