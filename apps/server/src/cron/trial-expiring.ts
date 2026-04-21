import { and, eq, gte, inArray, isNotNull, lte, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenants, tenantMembers } from '../db/schema/tenants.js';
import { createInAppNotification, dispatchByPreference } from '../modules/notifications/service.js';
import { logger } from '../logger.js';

const DAYS_BEFORE_EXPIRY = 3;

export async function trialExpiringNotifications() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + DAYS_BEFORE_EXPIRY * 24 * 60 * 60 * 1000);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(23, 59, 59, 999);

  const expiringTenants = await db
    .select({ id: tenants.id, plan: tenants.plan })
    .from(tenants)
    .where(and(
      ne(tenants.plan, 'enterprise'),
      isNotNull(tenants.planExpiresAt),
      gte(tenants.planExpiresAt, windowStart),
      lte(tenants.planExpiresAt, windowEnd),
      eq(tenants.isActive, true),
    ));

  if (expiringTenants.length === 0) {
    logger.info({ action: 'cron.trial_expiring.skip' }, 'Nenhum tenant expirando nos proximos 3 dias');
    return;
  }

  let notified = 0;

  for (const tenant of expiringTenants) {
    const isTrial = tenant.plan === 'trial';

    const adminMembers = await db
      .select({ userId: tenantMembers.userId })
      .from(tenantMembers)
      .where(and(
        eq(tenantMembers.tenantId, tenant.id),
        inArray(tenantMembers.role, ['superadmin', 'gerente']),
        eq(tenantMembers.isActive, true),
      ));

    for (const member of adminMembers) {
      try {
        if (isTrial) {
          // Trial: apenas in-app, sem email
          await createInAppNotification({
            tenantId: tenant.id,
            userId: member.userId,
            eventKey: 'trial_expiring',
            type: 'warning',
            title: 'Seu trial expira em 3 dias',
            message: 'Faca upgrade para continuar usando o ProteticFlow sem interrupcao.',
          });
        } else {
          // Starter+: in-app + email via preferencias do usuario
          await dispatchByPreference({
            tenantId: tenant.id,
            userId: member.userId,
            eventKey: 'trial_expiring',
            type: 'warning',
            title: 'Seu plano expira em 3 dias',
            message: 'Renove seu plano para continuar com acesso completo ao ProteticFlow.',
            emailSubject: 'Seu plano ProteticFlow expira em 3 dias',
            emailText: 'Seu plano ProteticFlow expira em 3 dias. Acesse /planos para renovar e continuar usando todos os recursos.',
          });
        }
        notified++;
      } catch (err) {
        logger.error(
          { action: 'cron.trial_expiring.notify.error', tenantId: tenant.id, userId: member.userId, err },
          'Falha ao notificar usuario sobre expiracao',
        );
      }
    }
  }

  logger.info(
    { action: 'cron.trial_expiring.finish', tenants: expiringTenants.length, notified },
    'Notificacoes de trial expirando processadas',
  );
}
