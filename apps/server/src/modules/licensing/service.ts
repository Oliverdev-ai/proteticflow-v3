import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { z } from 'zod';
import {
  PLAN_LIMITS,
  createCheckoutSessionSchema,
  superadminUpdateTenantPlanSchema,
  type GatedFeature,
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
  fullAccessUntil: Date | null;
  clientCount: number;
  jobCountThisMonth: number;
  userCount: number;
  priceTableCount: number;
  managerActionsThisMonth: number;
  managerActionsMonthRef: Date;
};

type StripeEventHandlerResult = 'processed' | 'ignored';
type CounterExecutor = Pick<typeof db, 'update' | 'insert'>;

export type LicenseStatus = {
  tenantId: number;
  plan: PlanTier;
  planExpiresAt: string | null;
  trialExpired: boolean;
  usage: Record<'clients' | 'jobsPerMonth' | 'users' | 'priceTables', {
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
    labs: 1,
    clients: tenant.clientCount,
    jobsPerMonth: tenant.jobCountThisMonth,
    users: tenant.userCount,
    priceTables: tenant.priceTableCount,
  };
  return counterMap[feature];
}

function getPromotionalWindowEnd(plan: PlanTier, fromDate: Date = new Date()): Date | null {
  const fullAccessDays = PLAN_LIMITS[plan].fullAccessDays;
  if (!fullAccessDays) return null;
  return new Date(fromDate.getTime() + fullAccessDays * 24 * 60 * 60 * 1000);
}

function hasFullAccess(plan: PlanTier, fullAccessUntil: Date | null): boolean {
  if (plan === 'enterprise') return true;
  return Boolean(fullAccessUntil && fullAccessUntil > new Date());
}

function getEffectiveFeatureLimit(
  tenant: Pick<TenantWithCounters, 'plan' | 'fullAccessUntil'>,
  feature: LimitableFeature,
): number | null {
  const plan = resolvePlanTier(tenant.plan);
  if (hasFullAccess(plan, tenant.fullAccessUntil)) {
    return null;
  }
  return PLAN_LIMITS[plan][feature];
}

function getEffectiveFeatureAccess(
  tenant: Pick<TenantWithCounters, 'plan' | 'fullAccessUntil'>,
): (typeof PLAN_LIMITS)[PlanTier]['features'] {
  const plan = resolvePlanTier(tenant.plan);
  if (hasFullAccess(plan, tenant.fullAccessUntil)) {
    return {
      reports: true,
      portal: true,
      ai: 'full',
      api: true,
      financial: true,
      voiceCommands: true,
    };
  }
  return PLAN_LIMITS[plan].features;
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
      fullAccessUntil: tenants.fullAccessUntil,
      clientCount: tenants.clientCount,
      jobCountThisMonth: tenants.jobCountThisMonth,
      userCount: tenants.userCount,
      priceTableCount: tenants.priceTableCount,
      managerActionsThisMonth: tenants.managerActionsThisMonth,
      managerActionsMonthRef: tenants.managerActionsMonthRef,
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

function isTrialRestricted(tenant: Pick<TenantWithCounters, 'plan' | 'fullAccessUntil'>): boolean {
  const plan = resolvePlanTier(tenant.plan);
  return plan === 'trial' && !hasFullAccess(plan, tenant.fullAccessUntil);
}

function isSameMonthWindow(reference: Date, now: Date): boolean {
  return reference.getUTCFullYear() === now.getUTCFullYear()
    && reference.getUTCMonth() === now.getUTCMonth();
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
  const limit = getEffectiveFeatureLimit(tenant, feature);
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
  const trialExpired = isTrialRestricted(tenant);

  const usage = (['clients', 'jobsPerMonth', 'users', 'priceTables'] as const).reduce((acc, feature) => {
    const current = getCurrentUsage(tenant, feature);
    const limit = getEffectiveFeatureLimit(tenant, feature);
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
    featureAccess: getEffectiveFeatureAccess(tenant),
  };
}

export async function checkFeatureAccess(
  tenantId: number,
  feature: GatedFeature,
): Promise<void> {
  const tenant = await getTenantOrThrow(tenantId);
  const plan = resolvePlanTier(tenant.plan);
  const access = getEffectiveFeatureAccess(tenant)[feature];

  if (!access) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Recurso "${feature}" nao disponivel no plano ${plan}. Faca upgrade para continuar.`,
    });
  }
}

export async function checkAiAccess(
  tenantId: number,
  requiredTier: 'basic' | 'full' = 'basic',
): Promise<void> {
  const tenant = await getTenantOrThrow(tenantId);
  const plan = resolvePlanTier(tenant.plan);
  const aiAccess = getEffectiveFeatureAccess(tenant).ai;

  if (!aiAccess) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `IA nao disponivel no plano ${plan}. Faca upgrade para continuar.`,
    });
  }

  if (requiredTier === 'full' && aiAccess !== 'full') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Este recurso exige IA completa. Plano atual: ${plan}.`,
    });
  }
}

export async function checkManagerActionLimit(tenantId: number): Promise<void> {
  const tenant = await getTenantOrThrow(tenantId);
  const plan = resolvePlanTier(tenant.plan);

  if (hasFullAccess(plan, tenant.fullAccessUntil)) {
    return;
  }

  const limit = PLAN_LIMITS[plan].managerActionsPerMonth;
  if (limit === null) {
    return;
  }

  const now = new Date();
  const monthRef = tenant.managerActionsMonthRef ?? now;
  const current = isSameMonthWindow(monthRef, now) ? tenant.managerActionsThisMonth : 0;

  if (current >= limit) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Limite mensal de acoes atingido (${limit}/${limit}). Faca upgrade para continuar.`,
    });
  }
}

export async function consumeManagerAction(tenantId: number): Promise<void> {
  const tenant = await getTenantOrThrow(tenantId);
  const plan = resolvePlanTier(tenant.plan);

  if (hasFullAccess(plan, tenant.fullAccessUntil)) {
    return;
  }

  const limit = PLAN_LIMITS[plan].managerActionsPerMonth;
  if (limit === null) {
    return;
  }

  const now = new Date();
  const monthRef = tenant.managerActionsMonthRef ?? now;
  const isSameMonth = isSameMonthWindow(monthRef, now);

  await db
    .update(tenants)
    .set(
      isSameMonth
        ? {
          managerActionsThisMonth: sql`${tenants.managerActionsThisMonth} + 1`,
          updatedAt: now,
        }
        : {
          managerActionsThisMonth: 1,
          managerActionsMonthRef: now,
          updatedAt: now,
        },
    )
    .where(eq(tenants.id, tenantId));
}

export async function getUsageForTenant(tenantId: number) {
  const tenant = await getTenantOrThrow(tenantId);
  const plan = resolvePlanTier(tenant.plan);
  const now = new Date();
  const fullAccessActive = hasFullAccess(plan, tenant.fullAccessUntil);
  const trialDaysLeft = fullAccessActive && tenant.fullAccessUntil
    ? Math.ceil((tenant.fullAccessUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const monthRef = tenant.managerActionsMonthRef ?? now;
  const managerActionsUsed = isSameMonthWindow(monthRef, now) ? tenant.managerActionsThisMonth : 0;
  const managerActionsLimit = fullAccessActive ? null : PLAN_LIMITS[plan].managerActionsPerMonth;

  return {
    plan,
    planStatus: plan === 'trial' && !fullAccessActive ? 'expired' : plan === 'trial' ? 'trial' : 'active',
    trialDaysLeft,
    fullAccessActive,
    fullAccessUntil: tenant.fullAccessUntil,
    managerActionsUsed,
    managerActionsLimit,
    planExpiresAt: tenant.planExpiresAt,
  };
}

export async function incrementCounter(
  tenantId: number,
  feature: LimitableFeature,
  executor: CounterExecutor = db,
): Promise<void> {
  if (feature !== 'labs') {
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
  }

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
  if (feature !== 'labs') {
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
  }

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
    const [currentTenant] = await tx
      .select({
        plan: tenants.plan,
        fullAccessUntil: tenants.fullAccessUntil,
      })
      .from(tenants)
      .where(eq(tenants.id, customer.tenantId))
      .limit(1);

    const now = new Date();
    const currentPlan = resolvePlanTier(currentTenant?.plan);
    const isPlanChange = currentPlan !== mappedPlan;
    const fullAccessUntil = isPlanChange
      ? getPromotionalWindowEnd(mappedPlan, now)
      : currentTenant?.fullAccessUntil ?? getPromotionalWindowEnd(mappedPlan, now);

    const tenantUpdate: {
      plan: PlanTier;
      planExpiresAt: Date | null;
      fullAccessUntil: Date | null;
      updatedAt: Date;
      managerActionsThisMonth?: number;
      managerActionsMonthRef?: Date;
    } = {
      plan: mappedPlan,
      planExpiresAt: periodEnd,
      fullAccessUntil,
      updatedAt: now,
    };

    if (isPlanChange) {
      tenantUpdate.managerActionsThisMonth = 0;
      tenantUpdate.managerActionsMonthRef = now;
    }

    await tx
      .update(tenants)
      .set(tenantUpdate)
      .where(eq(tenants.id, customer.tenantId));

    await tx
      .update(stripeCustomers)
      .set({
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        updatedAt: now,
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

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({
        plan: 'trial',
        planExpiresAt: now,
        fullAccessUntil: now,
        managerActionsThisMonth: 0,
        managerActionsMonthRef: now,
        updatedAt: now,
      })
      .where(eq(tenants.id, customer.tenantId));

    await tx
      .update(stripeCustomers)
      .set({
        stripeSubscriptionId: null,
        stripePriceId: null,
        updatedAt: now,
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
  const now = new Date();
  const fullAccessUntil = getPromotionalWindowEnd('trial', now);

  await db
    .update(tenants)
    .set({
      plan: 'trial',
      planExpiresAt: fullAccessUntil,
      fullAccessUntil,
      managerActionsThisMonth: 0,
      managerActionsMonthRef: now,
      updatedAt: now,
    })
    .where(eq(tenants.id, tenantId));
}

export async function processExpiredTrials(): Promise<void> {
  const now = new Date();
  const expiredTenants = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      fullAccessUntil: tenants.fullAccessUntil,
    })
    .from(tenants)
    .where(and(eq(tenants.plan, 'trial'), lt(tenants.fullAccessUntil, now)));

  if (expiredTenants.length === 0) {
    return;
  }

  logger.info(
    {
      action: 'licensing.trial_expired.audit',
      tenantCount: expiredTenants.length,
      tenantIds: expiredTenants.map((tenant) => tenant.id),
    },
    'Trials com degustacao encerrada identificados',
  );
}

export async function adminUpdatePlan(input: SuperadminUpdatePlanInput) {
  const now = new Date();
  const fullAccessUntil = getPromotionalWindowEnd(input.plan, now);

  const [updated] = await db
    .update(tenants)
    .set({
      plan: input.plan,
      planExpiresAt: input.planExpiresAt ? new Date(input.planExpiresAt) : fullAccessUntil,
      fullAccessUntil,
      managerActionsThisMonth: 0,
      managerActionsMonthRef: now,
      updatedAt: now,
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
      fullAccessUntil: tenants.fullAccessUntil,
      clientCount: tenants.clientCount,
      jobCountThisMonth: tenants.jobCountThisMonth,
      userCount: tenants.userCount,
      priceTableCount: tenants.priceTableCount,
      managerActionsThisMonth: tenants.managerActionsThisMonth,
      managerActionsMonthRef: tenants.managerActionsMonthRef,
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






















