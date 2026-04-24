import { and, eq, sql } from 'drizzle-orm';
import type { PlanTier } from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { userPreferences } from '../../db/schema/proactive.js';
import { tenantMembers, tenants } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import { getUserPreferences, type ProactiveUserPreferences } from './preferences.service.js';

export type ProactiveRecipient = {
  tenantId: number;
  userId: number;
  name: string;
  email: string | null;
  phone: string | null;
  plan: PlanTier;
  preferences: ProactiveUserPreferences;
};

function currentHhmm(now: Date): string {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function listBriefingRecipients(now: Date = new Date()): Promise<ProactiveRecipient[]> {
  const hhmm = currentHhmm(now);
  const rows = await db
    .select({
      tenantId: userPreferences.tenantId,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      plan: tenants.plan,
    })
    .from(userPreferences)
    .innerJoin(tenantMembers, and(
      eq(tenantMembers.tenantId, userPreferences.tenantId),
      eq(tenantMembers.userId, userPreferences.userId),
      eq(tenantMembers.isActive, true),
    ))
    .innerJoin(users, and(
      eq(users.id, userPreferences.userId),
      eq(users.isActive, true),
    ))
    .innerJoin(tenants, eq(tenants.id, userPreferences.tenantId))
    .where(and(
      eq(userPreferences.briefingEnabled, true),
      sql<boolean>`to_char(${userPreferences.briefingTime}, 'HH24:MI') = ${hhmm}`,
    ));

  const recipients: ProactiveRecipient[] = [];
  for (const row of rows) {
    const preferences = await getUserPreferences(row.tenantId, row.userId);
    recipients.push({
      tenantId: row.tenantId,
      userId: row.userId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      plan: row.plan,
      preferences,
    });
  }
  return recipients;
}

export async function getRecipient(
  tenantId: number,
  userId: number,
): Promise<ProactiveRecipient | null> {
  const [row] = await db
    .select({
      tenantId: tenants.id,
      plan: tenants.plan,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(tenantMembers)
    .innerJoin(users, and(
      eq(users.id, tenantMembers.userId),
      eq(users.isActive, true),
    ))
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.isActive, true),
    ))
    .limit(1);

  if (!row) return null;

  return {
    tenantId: row.tenantId,
    userId: row.userId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    plan: row.plan,
    preferences: await getUserPreferences(tenantId, userId),
  };
}

export async function listActiveTenantRecipients(tenantId: number): Promise<ProactiveRecipient[]> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      plan: tenants.plan,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(tenantMembers)
    .innerJoin(users, and(
      eq(users.id, tenantMembers.userId),
      eq(users.isActive, true),
    ))
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.isActive, true),
    ));

  const recipients: ProactiveRecipient[] = [];
  for (const row of rows) {
    recipients.push({
      tenantId: row.tenantId,
      plan: row.plan,
      userId: row.userId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      preferences: await getUserPreferences(row.tenantId, row.userId),
    });
  }
  return recipients;
}
