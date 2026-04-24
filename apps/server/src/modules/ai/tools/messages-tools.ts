import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import {
  muteAlertsSchema,
  messagesDraftToClientSchema,
  type MuteAlertsInput,
  type MessagesDraftToClientInput,
} from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { clients } from '../../../db/schema/clients.js';
import { jobs } from '../../../db/schema/jobs.js';
import { sendEmail } from '../../notifications/email.js';
import * as proactivePreferencesService from '../../proactive/preferences.service.js';
import type { CommandPreview, ConfirmationStep, ToolContext } from '../tool-executor.js';
import { resolveClientByName } from '../resolvers.js';

type PreviewStepResult = {
  step: ConfirmationStep;
  preview: CommandPreview;
  resolvedInput?: unknown;
};

type ClientContact = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
};

type ResolvedMessageChannel = 'whatsapp' | 'email' | 'sms';

function sanitizeMessageContext(raw: string): string {
  const withoutTemplates = raw
    .replace(/[{}]/g, '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ');

  return withoutTemplates
    .replace(/\s+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 400);
}

function firstName(fullName: string): string {
  const [first = 'Cliente'] = fullName.trim().split(/\s+/);
  return first;
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  const head = phone.slice(0, Math.min(4, phone.length - 2));
  const tail = phone.slice(-2);
  return `${head}${'*'.repeat(Math.max(2, phone.length - head.length - tail.length))}${tail}`;
}

function normalizeChannel(
  requested: MessagesDraftToClientInput['channel'],
  contact: ClientContact,
): ResolvedMessageChannel {
  if (requested) return requested;
  if (contact.phone) return 'whatsapp';
  return 'email';
}

async function getClientById(tenantId: number, clientId: number): Promise<ClientContact | null> {
  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      phone: clients.phone,
    })
    .from(clients)
    .where(and(
      eq(clients.tenantId, tenantId),
      eq(clients.id, clientId),
      isNull(clients.deletedAt),
    ))
    .limit(1);

  return client ?? null;
}

async function resolveClientContact(
  ctx: ToolContext,
  input: MessagesDraftToClientInput,
): Promise<
  | { status: 'resolved'; client: ClientContact }
  | { status: 'ambiguous'; candidates: Array<{ id: number; label: string; detail?: string }> }
> {
  if (input.clientId !== undefined) {
    const client = await getClientById(ctx.tenantId, input.clientId);
    if (!client) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado' });
    }
    return { status: 'resolved', client };
  }

  if (!input.clientName) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe clientId ou clientName' });
  }

  const resolved = await resolveClientByName(ctx.tenantId, input.clientName);
  if (resolved.status === 'not_found') {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Cliente "${input.clientName}" nao encontrado` });
  }

  if (resolved.status === 'ambiguous') {
    return {
      status: 'ambiguous',
      candidates: resolved.candidates.map((candidate) => {
        const detail = candidate.clinic ?? candidate.phone;
        return detail
          ? { id: candidate.id, label: candidate.name, detail }
          : { id: candidate.id, label: candidate.name };
      }),
    };
  }

  const client = await getClientById(ctx.tenantId, resolved.client.id);
  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado' });
  }

  return { status: 'resolved', client };
}

async function buildMessageDraft(
  ctx: ToolContext,
  contact: ClientContact,
  context: string,
  jobId?: number,
): Promise<string> {
  let jobSnippet = '';
  if (jobId) {
    const [job] = await db
      .select({
        id: jobs.id,
        code: jobs.code,
        status: jobs.status,
      })
      .from(jobs)
      .where(and(
        eq(jobs.tenantId, ctx.tenantId),
        eq(jobs.id, jobId),
        isNull(jobs.deletedAt),
      ))
      .limit(1);

    if (!job) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nao encontrada para este tenant' });
    }

    jobSnippet = ` Referencia: ${job.code} (${job.status}).`;
  }

  return `Olá ${firstName(contact.name)}, ${context}.${jobSnippet} Equipe ProteticFlow.`;
}

function assertChannelAvailability(channel: ResolvedMessageChannel, contact: ClientContact) {
  if (channel === 'email' && !contact.email) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cliente sem email cadastrado. Sugestao: use WhatsApp/SMS se houver telefone.',
    });
  }
  if ((channel === 'whatsapp' || channel === 'sms') && !contact.phone) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cliente sem telefone cadastrado. Sugestao: enviar por email.',
    });
  }
}

export async function buildMessagesDraftToClientPreviewStep(
  ctx: ToolContext,
  input: MessagesDraftToClientInput,
): Promise<PreviewStepResult> {
  const parsed = messagesDraftToClientSchema.parse(input);
  const sanitizedContext = sanitizeMessageContext(parsed.messageContext);

  const resolvedContact = await resolveClientContact(ctx, {
    ...parsed,
    messageContext: sanitizedContext,
  });

  if (resolvedContact.status === 'ambiguous') {
    const preview: CommandPreview = {
      title: 'Selecionar cliente',
      summary: 'Mais de um cliente encontrado com esse nome.',
      details: resolvedContact.candidates.slice(0, 5).map((candidate) => ({
        label: candidate.label,
        value: candidate.detail ?? `ID ${candidate.id}`,
      })),
    };

    return {
      step: {
        type: 'disambiguate',
        field: 'clientId',
        options: resolvedContact.candidates,
      },
      preview,
    };
  }

  const channel = normalizeChannel(parsed.channel, resolvedContact.client);
  assertChannelAvailability(channel, resolvedContact.client);

  const draft = await buildMessageDraft(
    ctx,
    resolvedContact.client,
    sanitizedContext,
    parsed.jobId,
  );

  const contactLabel = channel === 'email'
    ? resolvedContact.client.email ?? 'sem email'
    : resolvedContact.client.phone
      ? maskPhone(resolvedContact.client.phone)
      : 'sem telefone';

  const preview: CommandPreview = {
    title: `Mensagem para ${resolvedContact.client.name}`,
    summary: `Rascunho pronto para envio via ${channel}.`,
    details: [
      { label: 'Cliente', value: resolvedContact.client.name },
      { label: 'Canal', value: channel },
      { label: 'Contato', value: contactLabel },
      { label: 'Texto', value: draft },
    ],
  };

  return {
    step: {
      type: 'review',
      preview,
    },
    preview,
    resolvedInput: {
      clientId: resolvedContact.client.id,
      messageContext: sanitizedContext,
      channel,
      jobId: parsed.jobId,
    },
  };
}

export async function executeMessagesDraftToClient(
  ctx: ToolContext,
  input: MessagesDraftToClientInput,
) {
  const parsed = messagesDraftToClientSchema.parse(input);
  const sanitizedContext = sanitizeMessageContext(parsed.messageContext);
  const resolvedContact = await resolveClientContact(ctx, {
    ...parsed,
    messageContext: sanitizedContext,
  });

  if (resolvedContact.status === 'ambiguous') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cliente ambiguo. Confirme o clientId.' });
  }

  const channel = normalizeChannel(parsed.channel, resolvedContact.client);
  assertChannelAvailability(channel, resolvedContact.client);

  const draft = await buildMessageDraft(
    ctx,
    resolvedContact.client,
    sanitizedContext,
    parsed.jobId,
  );

  if (channel === 'email') {
    const sent = await sendEmail({
      to: resolvedContact.client.email!,
      subject: 'Atualizacao do laboratorio ProteticFlow',
      text: draft,
    });

    return {
      status: 'ok',
      channel,
      clientId: resolvedContact.client.id,
      clientName: resolvedContact.client.name,
      dispatched: sent.sent,
      draft,
    };
  }

  return {
    status: 'ok',
    channel,
    clientId: resolvedContact.client.id,
    clientName: resolvedContact.client.name,
    dispatched: false,
    draft,
    message: `Canal ${channel} ainda nao possui adaptador ativo neste ambiente.`,
  };
}

export async function executeMessagesMuteAlerts(
  ctx: ToolContext,
  input: MuteAlertsInput,
) {
  const parsed = muteAlertsSchema.parse(input);
  const targetUserId = parsed.userId ?? ctx.userId;

  if (
    targetUserId !== ctx.userId
    && ctx.role !== 'superadmin'
    && ctx.role !== 'gerente'
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Sem permissao para silenciar alertas de outro usuario',
    });
  }

  const updated = await proactivePreferencesService.muteAlerts(ctx.tenantId, ctx.userId, {
    userId: targetUserId,
    alertTypes: parsed.alertTypes,
    until: parsed.until,
  });

  return {
    status: 'ok',
    userId: updated.userId,
    alertTypesMuted: updated.alertTypesMuted,
    until: parsed.until ?? null,
  };
}
