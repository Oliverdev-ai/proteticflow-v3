import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { z } from 'zod';
import {
  PLAN_LIMITS,
  createCheckoutSessionSchema,
  superadminUpdateTenantPlanSchema,
  type LimitableFeature,
  type PlanTier,
} from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { tenants } from '../../db/schema/tenants.js';
import {
  featureUsageLogs,
  licenseChecks,
  stripeCustomers,
  stripeEvents,
} from '../../db/schema/licensing.js';

type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
type SuperadminUpdatePlanInput = z.infer<typeof superadminUpdateTenantPlanSchema>;

type TenantWithCounters = {
  id: number;
  plan: string;
  planExpiresAt: Date | null;
  clientCount: number;
  jobCountThisMonth: number;
  userCount: number;
  priceTableCount: number;
};

type StripeEventHandlerResult = 'processed' | 'ignored';
type CounterExecutor = Pick<typeof db, 'update' | 'insert'>;

export type LicenseStatus = {
  tenantId: number;
  plan: PlanTier;
  planExpiresAt: string | null;
  trialExpired: boolean;
  usage: Record<LimitableFeature, {
    current: number;
    limit: number | null;
    usagePercent: number | null;
  }>;
  featureAccess: (typeof PLAN_LIMITS)[PlanTier]['features'];
};

export type TenantAdminRow = {
  tenantId: number;
  name: string;
  slug: string;
  plan: PlanTier;
  planExpiresAt: string | null;
  usage: {
    clients: number;
    jobsPerMonth: number;
    users: number;
    priceTables: number;
  };
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

const PLAN_PRICE_MAP: Record<'starter' | 'pro' | 'enterprise', string | undefined> = {
  starter: env.STRIPE_PRICE_STARTER,
  pro: env.STRIPE_PRICE_PRO,
  enterprise: env.STRIPE_PRICE_ENTERPRISE,
};

function resolvePlanTier(plan: string | null | undefined): PlanTier {
  if (plan === 'starter' || plan === 'pro' || plan === 'enterprise' || plan === 'trial') {
    return plan;
  }
  return 'trial';
}

function getCurrentUsage(tenant: TenantWithCounters, feature: LimitableFeature): number {
  const counterMap: Record<LimitableFeature, number> = {
    clients: tenant.clientCount,
    jobsPerMonth: tenant.jobCountThisMonth,
    users: tenant.userCount,
    priceTables: tenant.priceTableCount,
  };
  return counterMap[feature];
}

function getFeatureLimit(plan: PlanTier, feature: LimitableFeature): number | null {
  const limits = PLAN_LIMITS[plan];
  return limits[feature];
}

function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Integracao Stripe nao configurada',
    });
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia',
  });
}

function getStripeWebhookSecret(): string {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Webhook Stripe nao configurado',
    });
  }
  return env.STRIPE_WEBHOOK_SECRET;
}

function resolvePlanByPriceId(priceId: string | null): PlanTier | null {
  if (!priceId) return null;
  if (env.STRIPE_PRICE_STARTER && priceId === env.STRIPE_PRICE_STARTER) return 'starter';
  if (env.STRIPE_PRICE_PRO && priceId === env.STRIPE_PRICE_PRO) return 'pro';
  if (env.STRIPE_PRICE_ENTERPRISE && priceId === env.STRIPE_PRICE_ENTERPRISE) return 'enterprise';
  return null;
}

async function getTenantOrThrow(tenantId: number): Promise<TenantWithCounters> {
  const [tenant] = await db
    .select({
      id: tenants.id,
      plan: tenants.plan,
      planExpiresAt: tenants.planExpiresAt,
      clientCount: tenants.clientCount,
      jobCountThisMonth: tenants.jobCountThisMonth,
      userCount: tenants.userCount,
      priceTableCount: tenants.priceTableCount,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  if (!tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });
  }

  return tenant;
}

async function getOrCreateStripeCustomer(tenantId: number): Promise<string> {
  const [existing] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.tenantId, tenantId));

  if (existing) {
    return existing.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const [tenant] = await db
    .select({
      name: tenants.name,
      email: tenants.email,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  const customerParams: Stripe.CustomerCreateParams = {
    name: tenant?.name ?? `Tenant ${tenantId}`,
    metadata: { tenantId: String(tenantId) },
  };
  if (tenant?.email) {
    customerParams.email = tenant.email;
  }

  const customer = await stripe.customers.create(customerParams);

  await db.insert(stripeCustomers).values({
    tenantId,
    stripeCustomerId: customer.id,
    updatedAt: new Date(),
  });

  return customer.id;
}

function isTrialExpired(plan: PlanTier, planExpiresAt: Date | null): boolean {
  return plan === 'trial' && Boolean(planExpiresAt && planExpiresAt < new Date());
}

async function logLicenseCheck(
  tenantId: number,
  userId: number | undefined,
  feature: LimitableFeature,
  allowed: boolean,
  plan: PlanTier,
  limit: number | null,
  current: number,
) {
  await db
    .insert(licenseChecks)
    .values({
      tenantId,
      userId: userId ?? null,
      feature,
      allowed,
      planAtCheck: plan,
      limitAtCheck: limit,
      currentUsageAtCheck: current,
    })
    .catch((error: unknown) => {
      logger.warn(
        { action: 'licensing.audit_log.failed', tenantId, feature, error },
        'Falha ao registrar auditoria de licenca',
      );
    });
}

export async function checkLimit(
  tenantId: number,
  feature: LimitableFeature,
  userId?: number,
): Promise<void> {
  const tenant = await getTenantOrThrow(tenantId);
  const plan = resolvePlanTier(tenant.plan);

  if (isTrialExpired(plan, tenant.planExpiresAt)) {
    await logLicenseCheck(tenantId, userId, feature, false, plan, 0, getCurrentUsage(tenant, feature));
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Periodo de trial encerrado. Faca upgrade para continuar.',
    });
  }

  const limit = getFeatureLimit(plan, feature);
  const current = getCurrentUsage(tenant, feature);
  const allowed = limit === null || current < limit;

  await logLicenseCheck(tenantId, userId, feature, allowed, plan, limit, current);

  if (!allowed) {
    logger.warn(
      { action: 'license.limit_hit', tenantId, feature, current, limit, plan },
      'Limite de plano atingido',
    );
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Limite do plano atingido para ${feature}. Faca upgrade para continuar.`,
    });
  }
}

export async function getLicenseStatus(tenantId: number): Promise<LicenseStatus> {
  const tenant = await getTenantOrThrow(tenantId);
  const plan = resolvePlanTier(tenant.plan);
  const trialExpired = isTrialExpired(plan, tenant.planExpiresAt);

  const usage = (['clients', 'jobsPerMonth', 'users', 'priceTables'] as const).reduce((acc, feature) => {
    const current = getCurrentUsage(tenant, feature);
    const limit = getFeatureLimit(plan, feature);
    const usagePercent = limit === null || limit === 0 ? null : Math.round((current / limit) * 100);

    acc[feature] = { current, limit, usagePercent };
    return acc;
  }, {} as LicenseStatus['usage']);

  return {
    tenantId,
    plan,
    planExpiresAt: tenant.planExpiresAt ? tenant.planExpiresAt.toISOString() : null,
    trialExpired,
    usage,
    featureAccess: PLAN_LIMITS[plan].features,
  };
}

export async function incrementCounter(
  tenantId: number,
  feature: LimitableFeature,
  executor: CounterExecutor = db,
): Promise<void> {
  const setByFeature = {
    clients: { clientCount: sql`${tenants.clientCount} + 1` },
    jobsPerMonth: { jobCountThisMonth: sql`${tenants.jobCountThisMonth} + 1` },
    users: { userCount: sql`${tenants.userCount} + 1` },
    priceTables: { priceTableCount: sql`${tenants.priceTableCount} + 1` },
  } as const;

  await executor
    .update(tenants)
    .set(setByFeature[feature])
    .where(eq(tenants.id, tenantId));

  await executor.insert(featureUsageLogs).values({
    tenantId,
    feature,
    action: 'create',
  }).catch(() => undefined);
}

export async function decrementCounter(
  tenantId: number,
  feature: LimitableFeature,
  executor: CounterExecutor = db,
): Promise<void> {
  const setByFeature = {
    clients: { clientCount: sql`GREATEST(${tenants.clientCount} - 1, 0)` },
    jobsPerMonth: { jobCountThisMonth: sql`GREATEST(${tenants.jobCountThisMonth} - 1, 0)` },
    users: { userCount: sql`GREATEST(${tenants.userCount} - 1, 0)` },
    priceTables: { priceTableCount: sql`GREATEST(${tenants.priceTableCount} - 1, 0)` },
  } as const;

  await executor
    .update(tenants)
    .set(setByFeature[feature])
    .where(eq(tenants.id, tenantId));

  await executor.insert(featureUsageLogs).values({
    tenantId,
    feature,
    action: 'delete',
  }).catch(() => undefined);
}

export async function resetMonthlyJobCounter(): Promise<void> {
  await db.update(tenants).set({ jobCountThisMonth: 0 });
  logger.info({ action: 'licensing.jobs_monthly_counter.reset' }, 'Contador mensal de jobs resetado');
}

export async function createCheckoutSession(
  tenantId: number,
  input: CreateCheckoutSessionInput,
): Promise<{ url: string }> {
  const priceId = PLAN_PRICE_MAP[input.planTier];
  if (!priceId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Price do plano ${input.planTier} nao configurado`,
    });
  }

  const stripe = getStripeClient();
  const customerId = await getOrCreateStripeCustomer(tenantId);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    metadata: {
      tenantId: String(tenantId),
      planTier: input.planTier,
    },
  });

  if (!session.url) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Falha ao criar sessao de checkout',
    });
  }

  return { url: session.url };
}

export async function createBillingPortalSession(tenantId: number): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const customerId = await getOrCreateStripeCustomer(tenantId);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.CORS_ORIGIN}/planos`,
  });

  return { url: session.url };
}

async function markStripeEvent(
  eventId: string,
  status: 'processed' | 'failed' | 'ignored',
  errorMessage?: string,
): Promise<void> {
  await db
    .update(stripeEvents)
    .set({
      status,
      errorMessage: errorMessage ?? null,
      processedAt: new Date(),
    })
    .where(eq(stripeEvents.stripeEventId, eventId));
}

async function syncSubscriptionToTenant(
  stripeCustomerId: string,
  subscriptionId: string | null,
  priceId: string | null,
  periodEnd: Date | null,
): Promise<void> {
  const [customer] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, stripeCustomerId));

  if (!customer) {
    logger.warn(
      { action: 'licensing.webhook.customer_not_found', stripeCustomerId },
      'Evento Stripe ignorado: customer nao mapeado',
    );
    return;
  }

  const mappedPlan = resolvePlanByPriceId(priceId);
  if (!mappedPlan) {
    logger.warn(
      { action: 'licensing.webhook.price_not_mapped', stripeCustomerId, priceId },
      'Evento Stripe com price sem mapeamento local',
    );
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({
        plan: mappedPlan,
        planExpiresAt: periodEnd,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, customer.tenantId));

    await tx
      .update(stripeCustomers)
      .set({
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        updatedAt: new Date(),
      })
      .where(eq(stripeCustomers.id, customer.id));
  });
}

async function handleCheckoutCompleted(event: Stripe.Event): Promise<StripeEventHandlerResult> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (!session.customer || !session.subscription) {
    return 'ignored';
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  await syncSubscriptionToTenant(
    String(session.customer),
    subscription.id,
    priceId,
    null,
  );

  return 'processed';
}

async function handleSubscriptionChanged(event: Stripe.Event): Promise<StripeEventHandlerResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = String(subscription.customer);
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  await syncSubscriptionToTenant(customerId, subscription.id, priceId, null);
  return 'processed';
}

async function handleSubscriptionDeleted(event: Stripe.Event): Promise<StripeEventHandlerResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = String(subscription.customer);

  const [customer] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId));

  if (!customer) return 'ignored';

  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({
        plan: 'trial',
        planExpiresAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, customer.tenantId));

    await tx
      .update(stripeCustomers)
      .set({
        stripeSubscriptionId: null,
        stripePriceId: null,
        updatedAt: new Date(),
      })
      .where(eq(stripeCustomers.id, customer.id));
  });

  return 'processed';
}

export async function handleStripeWebhook(
  rawBody: Buffer | string,
  signature: string,
): Promise<void> {
  if (!signature) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Assinatura do webhook ausente' });
  }

  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  const [existing] = await db
    .select()
    .from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, event.id));

  if (existing?.status === 'processed' || existing?.status === 'ignored') {
    return;
  }

  if (!existing) {
    await db.insert(stripeEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      status: 'pending',
      payload: JSON.stringify(event),
    });
  }

  try {
    let result: StripeEventHandlerResult = 'ignored';

    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(event);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        result = await handleSubscriptionChanged(event);
        break;
      case 'customer.subscription.deleted':
        result = await handleSubscriptionDeleted(event);
        break;
      case 'invoice.payment_failed':
        logger.warn(
          { action: 'licensing.webhook.invoice_payment_failed', eventId: event.id },
          'Pagamento Stripe falhou',
        );
        result = 'processed';
        break;
      default:
        result = 'ignored';
        break;
    }

    await markStripeEvent(event.id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido no webhook Stripe';
    await markStripeEvent(event.id, 'failed', message);
    throw error;
  }
}

export async function activateTrial(tenantId: number): Promise<void> {
  const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db
    .update(tenants)
    .set({
      plan: 'trial',
      planExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

export async function processExpiredTrials(): Promise<void> {
  const now = new Date();
  const expiredTenants = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      planExpiresAt: tenants.planExpiresAt,
    })
    .from(tenants)
    .where(and(eq(tenants.plan, 'trial'), lt(tenants.planExpiresAt, now)));

  if (expiredTenants.length === 0) {
    return;
  }

  logger.info(
    {
      action: 'licensing.trial_expired.audit',
      tenantCount: expiredTenants.length,
      tenantIds: expiredTenants.map((tenant) => tenant.id),
    },
    'Trials expirados identificados',
  );
}

export async function adminUpdatePlan(input: SuperadminUpdatePlanInput) {
  const [updated] = await db
    .update(tenants)
    .set({
      plan: input.plan,
      planExpiresAt: input.planExpiresAt ? new Date(input.planExpiresAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, input.tenantId))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });
  }

  return updated;
}

export async function listAllTenantsAdmin(): Promise<TenantAdminRow[]> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      plan: tenants.plan,
      planExpiresAt: tenants.planExpiresAt,
      clientCount: tenants.clientCount,
      jobCountThisMonth: tenants.jobCountThisMonth,
      userCount: tenants.userCount,
      priceTableCount: tenants.priceTableCount,
      stripeCustomerId: stripeCustomers.stripeCustomerId,
      stripeSubscriptionId: stripeCustomers.stripeSubscriptionId,
    })
    .from(tenants)
    .leftJoin(stripeCustomers, eq(stripeCustomers.tenantId, tenants.id))
    .orderBy(tenants.id);

  return rows.map((row) => ({
    tenantId: row.tenantId,
    name: row.name,
    slug: row.slug,
    plan: resolvePlanTier(row.plan),
    planExpiresAt: row.planExpiresAt ? row.planExpiresAt.toISOString() : null,
    usage: {
      clients: row.clientCount,
      jobsPerMonth: row.jobCountThisMonth,
      users: row.userCount,
      priceTables: row.priceTableCount,
    },
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeSubscriptionId: row.stripeSubscriptionId ?? null,
  }));
}
