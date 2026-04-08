import { createHash } from 'crypto';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import type { z } from 'zod';
import type {
  AiMessage,
  AutoResponseTemplate,
  ChatbotConversation,
  ChatbotMessage,
  SupportTicket,
  TicketMessage,
} from '@proteticflow/shared';
import {
  addTicketMessageSchema,
  createTicketSchema,
  escalateConversationSchema,
  listTicketsSchema,
  rateConversationSchema,
  sendChatMessageSchema,
  startConversationSchema,
  updateTicketSchema,
  upsertTemplateSchema,
} from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { portalTokens } from '../../db/schema/portal.js';
import {
  autoResponseTemplates,
  chatbotConversations,
  chatbotMessages,
  supportTickets,
  ticketMessages,
} from '../../db/schema/support.js';
import { detectIntent, generateChatbotResponse } from './chatbot.js';

type StartConversationInput = z.infer<typeof startConversationSchema>;
type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
type RateConversationInput = z.infer<typeof rateConversationSchema>;
type EscalateConversationInput = z.infer<typeof escalateConversationSchema>;
type CreateTicketInput = z.infer<typeof createTicketSchema>;
type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;
type ListTicketsInput = z.infer<typeof listTicketsSchema>;
type UpsertTemplateInput = z.infer<typeof upsertTemplateSchema>;

function hashPortalToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

function toConversationModel(row: typeof chatbotConversations.$inferSelect, messageCount?: number): ChatbotConversation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId ?? null,
    type: row.type,
    status: row.status,
    satisfactionScore: row.satisfactionScore ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(messageCount !== undefined ? { messageCount } : {}),
  };
}

function toChatbotMessageModel(row: typeof chatbotMessages.$inferSelect): ChatbotMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    intentDetected: row.intentDetected ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSupportTicketModel(row: typeof supportTickets.$inferSelect): SupportTicket {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId ?? null,
    conversationId: row.conversationId ?? null,
    assignedToUserId: row.assignedToUserId ?? null,
    priority: row.priority,
    status: row.status,
    subject: row.subject,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTicketMessageModel(row: typeof ticketMessages.$inferSelect): TicketMessage {
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorId: row.authorId ?? null,
    content: row.content,
    isInternal: row.isInternal === 1,
    createdAt: row.createdAt.toISOString(),
  };
}

function toTemplateModel(row: typeof autoResponseTemplates.$inferSelect): AutoResponseTemplate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    intent: row.intent,
    title: row.title,
    body: row.body,
    isActive: row.isActive === 1,
  };
}

async function getConversationOrThrow(conversationId: number) {
  const [conversation] = await db
    .select()
    .from(chatbotConversations)
    .where(eq(chatbotConversations.id, conversationId));

  if (!conversation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversa nao encontrada' });
  }

  return conversation;
}

async function getTicketOrThrow(tenantId: number, ticketId: number) {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.tenantId, tenantId), eq(supportTickets.id, ticketId)));

  if (!ticket) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket nao encontrado' });
  }

  return ticket;
}

async function resolveStartTenantAndClient(input: StartConversationInput) {
  const now = new Date();

  if (input.portalToken) {
    const tokenHash = hashPortalToken(input.portalToken);
    const [tokenRow] = await db
      .select()
      .from(portalTokens)
      .where(and(
        eq(portalTokens.tokenHash, tokenHash),
        isNull(portalTokens.revokedAt),
        gt(portalTokens.expiresAt, now),
      ));

    if (!tokenRow) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Token de portal invalido ou expirado' });
    }

    return {
      tenantId: tokenRow.tenantId,
      clientId: tokenRow.clientId,
      portalTokenId: tokenRow.id,
    };
  }

  if (input.portalTokenId) {
    const [tokenRow] = await db
      .select()
      .from(portalTokens)
      .where(and(
        eq(portalTokens.id, input.portalTokenId),
        isNull(portalTokens.revokedAt),
        gt(portalTokens.expiresAt, now),
      ));

    if (!tokenRow) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Portal token nao encontrado' });
    }

    return {
      tenantId: tokenRow.tenantId,
      clientId: tokenRow.clientId,
      portalTokenId: tokenRow.id,
    };
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Portal token e obrigatorio para iniciar conversa publica',
  });
}

function toAiHistory(messages: ChatbotMessage[]): AiMessage[] {
  return messages.map((message) => ({
    id: message.id,
    sessionId: message.conversationId,
    role: message.role,
    content: message.content,
    commandDetected: message.intentDetected,
    tokensUsed: null,
    createdAt: message.createdAt,
  }));
}

async function escalateConversationInternal(conversationId: number, reason?: string) {
  const conversation = await getConversationOrThrow(conversationId);

  const [existingTicket] = await db
    .select()
    .from(supportTickets)
    .where(and(
      eq(supportTickets.tenantId, conversation.tenantId),
      eq(supportTickets.conversationId, conversation.id),
    ))
    .orderBy(desc(supportTickets.id))
    .limit(1);

  if (existingTicket) {
    if (conversation.status !== 'escalated') {
      await db
        .update(chatbotConversations)
        .set({ status: 'escalated', escalatedAt: new Date(), updatedAt: new Date() })
        .where(eq(chatbotConversations.id, conversation.id));
    }
    return toSupportTicketModel(existingTicket);
  }

  const escalationReason = reason?.trim() || 'Escalacao automatica a partir do chatbot';

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      tenantId: conversation.tenantId,
      clientId: conversation.clientId,
      conversationId: conversation.id,
      priority: conversation.type === 'complaint' ? 'high' : 'medium',
      status: 'open',
      subject: `Escalacao da conversa #${conversation.id}`,
      description: escalationReason,
      updatedAt: new Date(),
    })
    .returning();

  if (!ticket) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao escalar conversa' });
  }

  await db
    .update(chatbotConversations)
    .set({ status: 'escalated', escalatedAt: new Date(), updatedAt: new Date() })
    .where(eq(chatbotConversations.id, conversation.id));

  return toSupportTicketModel(ticket);
}

export async function startConversation(input: StartConversationInput): Promise<ChatbotConversation> {
  const resolved = await resolveStartTenantAndClient(input);

  const [conversation] = await db
    .insert(chatbotConversations)
    .values({
      tenantId: resolved.tenantId,
      clientId: resolved.clientId,
      portalTokenId: resolved.portalTokenId,
      type: input.type,
      status: 'open',
      updatedAt: new Date(),
    })
    .returning();

  if (!conversation) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao iniciar conversa' });
  }

  return toConversationModel(conversation, 0);
}

export async function sendChatMessage(input: SendChatMessageInput) {
  const conversation = await getConversationOrThrow(input.conversationId);
  const intent = detectIntent(input.content);

  const recentRows = await db
    .select()
    .from(chatbotMessages)
    .where(and(
      eq(chatbotMessages.tenantId, conversation.tenantId),
      eq(chatbotMessages.conversationId, conversation.id),
    ))
    .orderBy(desc(chatbotMessages.id))
    .limit(10);
  const history = recentRows.reverse().map(toChatbotMessageModel);

  const [userMsg] = await db
    .insert(chatbotMessages)
    .values({
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      role: 'user',
      content: input.content,
      intentDetected: intent,
    })
    .returning();

  if (!userMsg) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao salvar mensagem do cliente' });
  }

  const assistantText = await generateChatbotResponse(
    conversation.tenantId,
    input.content,
    toAiHistory(history),
    intent,
  );

  const [assistantMsg] = await db
    .insert(chatbotMessages)
    .values({
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantText,
      intentDetected: intent,
    })
    .returning();

  if (!assistantMsg) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao salvar resposta do chatbot' });
  }

  await db
    .update(chatbotConversations)
    .set({
      type: (intent as typeof chatbotConversations.$inferInsert['type']) ?? conversation.type,
      updatedAt: new Date(),
    })
    .where(eq(chatbotConversations.id, conversation.id));

  const shouldEscalate = intent === 'complaint';
  const escalatedTicket = shouldEscalate
    ? await escalateConversationInternal(conversation.id, 'Escalacao automatica por intencao de reclamacao')
    : null;

  return {
    userMsg: toChatbotMessageModel(userMsg),
    assistantMsg: toChatbotMessageModel(assistantMsg),
    intent,
    shouldEscalate,
    ticket: escalatedTicket,
  };
}

export async function rateConversation(input: RateConversationInput) {
  const conversation = await getConversationOrThrow(input.conversationId);

  await db
    .update(chatbotConversations)
    .set({
      satisfactionScore: input.score,
      status: input.score < 3 ? 'escalated' : conversation.status,
      updatedAt: new Date(),
    })
    .where(eq(chatbotConversations.id, conversation.id));

  const shouldEscalate = input.score < 3;
  const ticket = shouldEscalate
    ? await escalateConversationInternal(conversation.id, `Escalacao automatica por baixa satisfacao: ${input.score}`)
    : null;

  return { success: true, shouldEscalate, ticket };
}

export async function escalateConversation(input: EscalateConversationInput) {
  return escalateConversationInternal(input.conversationId, input.reason);
}

export async function createTicket(tenantId: number, _userId: number, input: CreateTicketInput): Promise<SupportTicket> {
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      tenantId,
      clientId: input.clientId ?? null,
      conversationId: input.conversationId ?? null,
      priority: input.priority,
      status: 'open',
      subject: input.subject,
      description: input.description,
      updatedAt: new Date(),
    })
    .returning();

  if (!ticket) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar ticket' });
  }

  return toSupportTicketModel(ticket);
}

export async function updateTicket(tenantId: number, _userId: number, input: UpdateTicketInput): Promise<SupportTicket> {
  const ticket = await getTicketOrThrow(tenantId, input.ticketId);

  const now = new Date();
  const [updated] = await db
    .update(supportTickets)
    .set({
      status: input.status ?? ticket.status,
      priority: input.priority ?? ticket.priority,
      assignedToUserId: input.assignedToUserId === undefined ? ticket.assignedToUserId : input.assignedToUserId,
      resolvedAt: input.status === 'resolved' ? now : ticket.resolvedAt,
      closedAt: input.status === 'closed' ? now : ticket.closedAt,
      updatedAt: now,
    })
    .where(and(eq(supportTickets.tenantId, tenantId), eq(supportTickets.id, input.ticketId)))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar ticket' });
  }

  return toSupportTicketModel(updated);
}

export async function addTicketMessage(tenantId: number, userId: number, input: AddTicketMessageInput): Promise<TicketMessage> {
  await getTicketOrThrow(tenantId, input.ticketId);

  const [message] = await db
    .insert(ticketMessages)
    .values({
      tenantId,
      ticketId: input.ticketId,
      authorId: userId,
      content: input.content,
      isInternal: input.isInternal ? 1 : 0,
    })
    .returning();

  if (!message) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao adicionar mensagem ao ticket' });
  }

  return toTicketMessageModel(message);
}

export async function listTickets(tenantId: number, userId: number, input: ListTicketsInput) {
  const conditions = [eq(supportTickets.tenantId, tenantId)];
  if (input.status) conditions.push(eq(supportTickets.status, input.status));
  if (input.priority) conditions.push(eq(supportTickets.priority, input.priority));
  if (input.assignedToMe) conditions.push(eq(supportTickets.assignedToUserId, userId));
  if (input.cursor) conditions.push(lt(supportTickets.id, input.cursor));

  const rows = await db
    .select()
    .from(supportTickets)
    .where(and(...conditions))
    .orderBy(desc(supportTickets.id))
    .limit(input.limit + 1);

  const pageRows = rows.slice(0, input.limit);
  const nextCursor = rows.length > input.limit ? pageRows[pageRows.length - 1]?.id ?? null : null;

  return {
    data: pageRows.map(toSupportTicketModel),
    nextCursor,
  };
}

export async function getTicket(tenantId: number, ticketId: number) {
  const ticket = await getTicketOrThrow(tenantId, ticketId);

  const messages = await db
    .select()
    .from(ticketMessages)
    .where(and(eq(ticketMessages.tenantId, tenantId), eq(ticketMessages.ticketId, ticketId)))
    .orderBy(ticketMessages.createdAt, ticketMessages.id);

  return {
    ticket: toSupportTicketModel(ticket),
    messages: messages.map(toTicketMessageModel),
  };
}

export async function listTemplates(tenantId: number): Promise<AutoResponseTemplate[]> {
  const rows = await db
    .select()
    .from(autoResponseTemplates)
    .where(eq(autoResponseTemplates.tenantId, tenantId))
    .orderBy(desc(autoResponseTemplates.id));

  return rows.map(toTemplateModel);
}

export async function upsertTemplate(tenantId: number, userId: number, input: UpsertTemplateInput): Promise<AutoResponseTemplate> {
  if (input.id) {
    const [updated] = await db
      .update(autoResponseTemplates)
      .set({
        intent: input.intent,
        title: input.title,
        body: input.body,
        isActive: input.isActive ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(and(eq(autoResponseTemplates.tenantId, tenantId), eq(autoResponseTemplates.id, input.id)))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Template nao encontrado' });
    }

    return toTemplateModel(updated);
  }

  const [created] = await db
    .insert(autoResponseTemplates)
    .values({
      tenantId,
      intent: input.intent,
      title: input.title,
      body: input.body,
      isActive: input.isActive ? 1 : 0,
      createdBy: userId,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar template' });
  }

  return toTemplateModel(created);
}

export async function deleteTemplate(tenantId: number, templateId: number) {
  const [deleted] = await db
    .delete(autoResponseTemplates)
    .where(and(eq(autoResponseTemplates.tenantId, tenantId), eq(autoResponseTemplates.id, templateId)))
    .returning();

  if (!deleted) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Template nao encontrado' });
  }

  return { success: true };
}
