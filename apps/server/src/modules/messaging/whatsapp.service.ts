import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { clients } from '../../db/schema/clients.js';
import { sendBlipWhatsApp } from './providers/blip.provider.js';
import { getTenantWhatsappConfigById } from './whatsapp-config.service.js';
import {
  canSendWhatsappByOptIn,
  normalizePhoneE164,
  requestWhatsappOptIn,
  sanitizeWhatsappBody,
} from './opt-in.service.js';
import {
  createOutboundWhatsappMessageLog,
  getWhatsappUsage,
  listWhatsappConversation,
  listWhatsappTemplatesStatus,
  markWhatsappMessageFailed,
  markWhatsappMessageSent,
  type WhatsappProvider,
} from './whatsapp-messages.service.js';
import { recordWhatsappOptInBlocked, recordWhatsappSend, observeWhatsappSendLatency } from '../../metrics/whatsapp.js';

function formatTemplateBody(
  templateName: string,
  variables: Record<string, unknown> | undefined,
): string {
  if (!variables || Object.keys(variables).length === 0) {
    return `[template:${templateName}]`;
  }
  const rendered = Object.entries(variables)
    .slice(0, 20)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' | ');
  return `[template:${templateName}] ${rendered}`;
}

async function resolveClientPhone(tenantId: number, clientId: number): Promise<string> {
  const [client] = await db
    .select({
      phone: clients.phone,
    })
    .from(clients)
    .where(and(
      eq(clients.tenantId, tenantId),
      eq(clients.id, clientId),
      isNull(clients.deletedAt),
    ))
    .limit(1);

  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado' });
  }
  if (!client.phone) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cliente sem telefone cadastrado' });
  }
  const phoneE164 = normalizePhoneE164(client.phone);
  if (!phoneE164) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Telefone do cliente fora do padrao E.164' });
  }
  return phoneE164;
}

async function resolvePhoneFromInput(input: {
  tenantId: number;
  clientId?: number;
  phone?: string;
}): Promise<{ phoneE164: string; clientId: number | null }> {
  if (input.clientId !== undefined) {
    const phoneE164 = await resolveClientPhone(input.tenantId, input.clientId);
    return { phoneE164, clientId: input.clientId };
  }
  if (!input.phone) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe clientId ou phone' });
  }
  const phoneE164 = normalizePhoneE164(input.phone);
  if (!phoneE164) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Telefone invalido para WhatsApp (E.164)' });
  }
  return { phoneE164, clientId: null };
}

async function resolveTenantProvider(tenantId: number): Promise<{
  provider: WhatsappProvider;
  blipConfig?: { apiToken: string; fromNumber: string; baseUrl?: string };
}> {
  const tenant = await getTenantWhatsappConfigById(tenantId);
  if (!tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });
  }
  if (!tenant.whatsappEnabled) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'WhatsApp desabilitado para o tenant' });
  }

  if (tenant.whatsappConfig.provider === 'mock') {
    return { provider: 'mock' };
  }

  if (tenant.whatsappConfig.provider === 'blip') {
    const blip = tenant.whatsappConfig.blip;
    if (!blip?.apiToken || !blip.fromNumber) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Configuracao Blip incompleta no tenant' });
    }
    return {
      provider: 'blip',
      blipConfig: blip,
    };
  }

  throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Provider WhatsApp ainda nao suportado' });
}

async function dispatchWhatsappMessage(input: {
  tenantId: number;
  userId: number;
  clientId?: number | null;
  phoneE164: string;
  templateName: string | null;
  body: string;
  provider: WhatsappProvider;
  blipConfig?: { apiToken: string; fromNumber: string; baseUrl?: string };
  meta?: Record<string, unknown>;
}): Promise<{ providerMessageId: string }> {
  const startedAt = Date.now();
  const createPayload: Parameters<typeof createOutboundWhatsappMessageLog>[0] = {
    tenantId: input.tenantId,
    userId: input.userId,
    clientId: input.clientId ?? null,
    provider: input.provider,
    phoneE164: input.phoneE164,
    body: input.body,
    templateName: input.templateName,
    ...(input.meta ? { meta: input.meta } : {}),
  };
  const logId = await createOutboundWhatsappMessageLog(createPayload);

  try {
    if (input.provider === 'mock') {
      const providerMessageId = `mock-${logId}`;
      await markWhatsappMessageSent({
        id: logId,
        providerMessageId,
        ...(input.meta ? { meta: input.meta } : {}),
      });
      recordWhatsappSend(input.tenantId, input.provider, 'sent');
      observeWhatsappSendLatency(input.tenantId, input.provider, Date.now() - startedAt);
      return { providerMessageId };
    }

    const sent = await sendBlipWhatsApp(input.blipConfig!, input.phoneE164, input.body);
    await markWhatsappMessageSent({
      id: logId,
      providerMessageId: sent.id,
      ...(input.meta ? { meta: input.meta } : {}),
    });
    recordWhatsappSend(input.tenantId, input.provider, 'sent');
    observeWhatsappSendLatency(input.tenantId, input.provider, Date.now() - startedAt);
    return { providerMessageId: sent.id };
  } catch (error) {
    await markWhatsappMessageFailed({
      id: logId,
      errorMessage: error instanceof Error ? error.message : 'Falha ao enviar mensagem WhatsApp',
      ...(input.meta ? { meta: input.meta } : {}),
    });
    recordWhatsappSend(input.tenantId, input.provider, 'failed');
    observeWhatsappSendLatency(input.tenantId, input.provider, Date.now() - startedAt);
    throw error;
  }
}

export async function sendWhatsappTemplateMessage(input: {
  tenantId: number;
  userId: number;
  clientId?: number;
  phone?: string;
  templateName: string;
  language?: string;
  variables?: Record<string, unknown>;
}): Promise<{
  status: 'sent';
  provider: WhatsappProvider;
  providerMessageId: string;
  phoneE164: string;
}> {
  const phonePayload: Parameters<typeof resolvePhoneFromInput>[0] = {
    tenantId: input.tenantId,
    ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  };
  const resolved = await resolvePhoneFromInput(phonePayload);

  const hasOptIn = await canSendWhatsappByOptIn(input.tenantId, resolved.phoneE164);
  if (!hasOptIn) {
    recordWhatsappOptInBlocked(input.tenantId, 'send_template_without_opt_in');
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Envio bloqueado: cliente sem opt-in valido para WhatsApp',
    });
  }

  const tenantProvider = await resolveTenantProvider(input.tenantId);
  const body = sanitizeWhatsappBody(formatTemplateBody(input.templateName, input.variables));
  const sendPayload: Parameters<typeof dispatchWhatsappMessage>[0] = {
    tenantId: input.tenantId,
    userId: input.userId,
    clientId: resolved.clientId,
    phoneE164: resolved.phoneE164,
    templateName: input.templateName,
    body,
    provider: tenantProvider.provider,
    meta: {
      type: 'template',
      language: input.language ?? 'pt_BR',
      variables: input.variables ?? {},
    },
    ...(tenantProvider.blipConfig ? { blipConfig: tenantProvider.blipConfig } : {}),
  };
  const sent = await dispatchWhatsappMessage(sendPayload);

  return {
    status: 'sent',
    provider: tenantProvider.provider,
    providerMessageId: sent.providerMessageId,
    phoneE164: resolved.phoneE164,
  };
}

export async function requestWhatsappOptInAndNotify(input: {
  tenantId: number;
  userId: number;
  clientId?: number;
  phone?: string;
}): Promise<{ status: 'pending'; phoneE164: string; provider: WhatsappProvider }> {
  const phonePayload: Parameters<typeof resolvePhoneFromInput>[0] = {
    tenantId: input.tenantId,
    ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  };
  const resolved = await resolvePhoneFromInput(phonePayload);
  const tenantProvider = await resolveTenantProvider(input.tenantId);

  await requestWhatsappOptIn({
    tenantId: input.tenantId,
    clientId: resolved.clientId,
    phoneE164: resolved.phoneE164,
    updatedBy: input.userId,
    evidence: {
      source: 'tool.request_whatsapp_opt_in',
      capturedAt: new Date().toISOString(),
    },
  });

  const body = sanitizeWhatsappBody('Para confirmar o recebimento de mensagens via WhatsApp, responda: SIM');
  const notifyPayload: Parameters<typeof dispatchWhatsappMessage>[0] = {
    tenantId: input.tenantId,
    userId: input.userId,
    clientId: resolved.clientId,
    phoneE164: resolved.phoneE164,
    templateName: 'request_opt_in',
    body,
    provider: tenantProvider.provider,
    meta: {
      type: 'opt_in_request',
    },
    ...(tenantProvider.blipConfig ? { blipConfig: tenantProvider.blipConfig } : {}),
  };
  await dispatchWhatsappMessage(notifyPayload);

  return {
    status: 'pending',
    phoneE164: resolved.phoneE164,
    provider: tenantProvider.provider,
  };
}

export async function getWhatsappUsageForPeriod(input: {
  tenantId: number;
  startAt?: string;
  endAt?: string;
}): Promise<{
  period: { startAt: string; endAt: string };
  usage: {
    total: number;
    outbound: number;
    inbound: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
}> {
  const now = new Date();
  const start = input.startAt ? new Date(input.startAt) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = input.endAt ? new Date(input.endAt) : now;
  const usage = await getWhatsappUsage({
    tenantId: input.tenantId,
    startAt: start,
    endAt: end,
  });
  return {
    period: { startAt: start.toISOString(), endAt: end.toISOString() },
    usage,
  };
}

export async function getWhatsappTemplatesStatus(tenantId: number) {
  return listWhatsappTemplatesStatus({ tenantId });
}

export async function getWhatsappConversationHistory(input: {
  tenantId: number;
  clientId?: number;
  phone?: string;
  limit?: number;
}) {
  const phonePayload: Parameters<typeof resolvePhoneFromInput>[0] = {
    tenantId: input.tenantId,
    ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  };
  const resolved = await resolvePhoneFromInput(phonePayload);
  const limit = Math.max(1, Math.min(100, input.limit ?? 30));
  const messages = await listWhatsappConversation({
    tenantId: input.tenantId,
    phoneE164: resolved.phoneE164,
    limit,
  });
  return {
    phoneE164: resolved.phoneE164,
    clientId: resolved.clientId,
    messages,
  };
}
