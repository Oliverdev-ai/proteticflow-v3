import {
  getWhatsappConversationSchema,
  getWhatsappTemplatesStatusSchema,
  getWhatsappUsageSchema,
  requestWhatsappOptInSchema,
  sendWhatsappTemplateSchema,
} from '@proteticflow/shared';
import type { ToolContext } from '../tool-executor.js';
import {
  getWhatsappConversationHistory,
  getWhatsappTemplatesStatus,
  getWhatsappUsageForPeriod,
  requestWhatsappOptInAndNotify,
  sendWhatsappTemplateMessage,
} from '../../messaging/whatsapp.service.js';

export async function executeSendWhatsappTemplate(
  ctx: ToolContext,
  input: unknown,
) {
  const parsed = sendWhatsappTemplateSchema.parse(input);
  const payload: Parameters<typeof sendWhatsappTemplateMessage>[0] = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    templateName: parsed.templateName,
    language: parsed.language,
    ...(parsed.clientId !== undefined ? { clientId: parsed.clientId } : {}),
    ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
    ...(parsed.variables !== undefined ? { variables: parsed.variables } : {}),
  };

  return sendWhatsappTemplateMessage(payload);
}

export async function executeRequestWhatsappOptIn(
  ctx: ToolContext,
  input: unknown,
) {
  const parsed = requestWhatsappOptInSchema.parse(input);
  const payload: Parameters<typeof requestWhatsappOptInAndNotify>[0] = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    ...(parsed.clientId !== undefined ? { clientId: parsed.clientId } : {}),
    ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
  };

  return requestWhatsappOptInAndNotify(payload);
}

export async function executeGetWhatsappUsage(
  ctx: ToolContext,
  input: unknown,
) {
  const parsed = getWhatsappUsageSchema.parse(input);
  const payload: Parameters<typeof getWhatsappUsageForPeriod>[0] = {
    tenantId: ctx.tenantId,
    ...(parsed.startAt !== undefined ? { startAt: parsed.startAt } : {}),
    ...(parsed.endAt !== undefined ? { endAt: parsed.endAt } : {}),
  };

  return getWhatsappUsageForPeriod(payload);
}

export async function executeGetWhatsappTemplatesStatus(
  ctx: ToolContext,
  input: unknown,
) {
  getWhatsappTemplatesStatusSchema.parse(input);
  return getWhatsappTemplatesStatus(ctx.tenantId);
}

export async function executeGetWhatsappConversation(
  ctx: ToolContext,
  input: unknown,
) {
  const parsed = getWhatsappConversationSchema.parse(input);
  const payload: Parameters<typeof getWhatsappConversationHistory>[0] = {
    tenantId: ctx.tenantId,
    limit: parsed.limit,
    ...(parsed.clientId !== undefined ? { clientId: parsed.clientId } : {}),
    ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
  };

  return getWhatsappConversationHistory(payload);
}
