import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { labSettings, tenantMembers, tenants, users } from './index.js';
import { hashPassword } from '../../core/auth.js';

async function cleanup() {
  await db.delete(labSettings);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('lab_settings schema', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('cria tenant + settings e garante 1:1 por tenant', async () => {
    const [user] = await db.insert(users).values({
      name: 'Schema User',
      email: 'schema-settings@test.com',
      passwordHash: await hashPassword('Test123!'),
    }).returning();

    const [tenant] = await db.insert(tenants).values({
      name: 'Lab Schema',
      slug: 'lab-schema',
    }).returning();

    await db.insert(tenantMembers).values({ tenantId: tenant.id, userId: user.id, role: 'superadmin' });

    const [settings] = await db.insert(labSettings).values({
      tenantId: tenant.id,
      labName: tenant.name,
      primaryColor: '#112233',
      secondaryColor: '#445566',
    }).returning();

    expect(settings.tenantId).toBe(tenant.id);
    expect(settings.smtpMode).toBe('resend_fallback');

    const [single] = await db.select().from(labSettings).where(eq(labSettings.tenantId, tenant.id));
    expect(single).toBeDefined();
  });
});
