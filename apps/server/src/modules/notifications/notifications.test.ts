import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  deadlineNotifLog,
  notificationPreferences,
  notifications,
  osBlocks,
  pushSubscriptions,
  tenantMembers,
  tenants,
  users,
} from '../../db/schema/index.js';
import { hashPassword } from '../../core/auth.js';
import * as notificationService from './service.js';

async function createUser(email: string) {
  const [user] = await db
    .insert(users)
    .values({
      name: 'Notif User',
      email,
      passwordHash: await hashPassword('Test123!'),
    })
    .returning();
  return user!;
}

async function createTenantFor(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(deadlineNotifLog);
  await db.delete(notificationPreferences);
  await db.delete(notifications);
  await db.delete(pushSubscriptions);
  await db.delete(osBlocks);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('notifications service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('lista e conta notificacoes por tenant/user sem vazamento', async () => {
    const userA = await createUser('notif-a@test.com');
    const userB = await createUser('notif-b@test.com');
    const tenantA = await createTenantFor(userA.id, 'Tenant A');
    const tenantB = await createTenantFor(userB.id, 'Tenant B');

    await notificationService.createInAppNotification({
      tenantId: tenantA.id,
      userId: userA.id,
      eventKey: 'report_ready',
      type: 'info',
      title: 'A1',
      message: 'M1',
    });

    await notificationService.createInAppNotification({
      tenantId: tenantB.id,
      userId: userB.id,
      eventKey: 'report_ready',
      type: 'warning',
      title: 'B1',
      message: 'M2',
    });

    const listA = await notificationService.listUserNotifications(tenantA.id, userA.id, { unreadOnly: false, limit: 20 });
    const unreadA = await notificationService.countUnread(tenantA.id, userA.id);

    expect(listA).toHaveLength(1);
    expect(listA[0]?.title).toBe('A1');
    expect(unreadA).toBe(1);
  });

  it('marca lida por ids e respeita isolamento de tenant', async () => {
    const userA = await createUser('notif-mark-a@test.com');
    const userB = await createUser('notif-mark-b@test.com');
    const tenantA = await createTenantFor(userA.id, 'Tenant MA');
    const tenantB = await createTenantFor(userB.id, 'Tenant MB');

    const notifA = (await notificationService.createInAppNotification({
      tenantId: tenantA.id,
      userId: userA.id,
      eventKey: 'deadline_24h',
      type: 'warning',
      title: 'A',
      message: 'A',
    }))!;

    const notifB = (await notificationService.createInAppNotification({
      tenantId: tenantB.id,
      userId: userB.id,
      eventKey: 'deadline_24h',
      type: 'warning',
      title: 'B',
      message: 'B',
    }))!;

    const result = await notificationService.markRead(tenantA.id, userA.id, [notifA.id, notifB.id]);
    expect(result.updated).toBe(1);

    const [rowA] = await db
      .select({ isRead: notifications.isRead })
      .from(notifications)
      .where(eq(notifications.id, notifA.id));

    const [rowB] = await db
      .select({ isRead: notifications.isRead })
      .from(notifications)
      .where(eq(notifications.id, notifB.id));

    expect(rowA?.isRead).toBe(true);
    expect(rowB?.isRead).toBe(false);
  });

  it('upsert de preferencia e subscriptions funciona', async () => {
    const user = await createUser('notif-pref@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Pref');

    const defaults = await notificationService.listPreferences(tenant.id, user.id);
    expect(defaults.length).toBeGreaterThan(0);

    await notificationService.upsertPreference(tenant.id, user.id, {
      eventKey: 'report_ready',
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: false,
    });

    const prefsAfter = await notificationService.listPreferences(tenant.id, user.id);
    const reportReady = prefsAfter.find((p) => p.eventKey === 'report_ready');
    expect(reportReady?.pushEnabled).toBe(false);
    expect(reportReady?.emailEnabled).toBe(false);

    await notificationService.savePushSubscription(tenant.id, user.id, {
      endpoint: 'https://example.com/subscription',
      keys: { p256dh: 'abc', auth: 'def' },
    }, 'Vitest');

    await notificationService.savePushSubscription(tenant.id, user.id, {
      endpoint: 'https://example.com/subscription',
      keys: { p256dh: 'abc-2', auth: 'def-2' },
    }, 'Vitest2');

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.tenantId, tenant.id), eq(pushSubscriptions.userId, user.id)));

    expect(subs).toHaveLength(1);
    expect(subs[0]?.p256dh).toBe('abc-2');

    await notificationService.deletePushSubscription(tenant.id, user.id, 'https://example.com/subscription');

    const subsAfterDelete = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.tenantId, tenant.id), eq(pushSubscriptions.userId, user.id)));

    expect(subsAfterDelete).toHaveLength(0);
  });

  it('dispatch cria notificacao in-app e respeita preferencia de canal', async () => {
    const user = await createUser('notif-dispatch@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Dispatch');

    await notificationService.upsertPreference(tenant.id, user.id, {
      eventKey: 'report_ready',
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: false,
    });

    await notificationService.dispatchByPreference({
      tenantId: tenant.id,
      userId: user.id,
      eventKey: 'report_ready',
      type: 'info',
      title: 'Relatorio pronto',
      message: 'Seu relatorio foi processado.',
    });

    const list = await notificationService.listUserNotifications(tenant.id, user.id, {
      unreadOnly: false,
      limit: 20,
    });

    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Relatorio pronto');
  });
});
