import { z } from 'zod';

export const startConversationSchema = z.object({
  portalTokenId: z.number().int().positive().optional(),
  portalToken: z.string().min(10).optional(),
  clientId: z.number().int().positive().optional(),
  type: z.enum(['status_query', 'scheduling', 'quote', 'technical_support', 'general', 'complaint']).default('general'),
});

export const sendChatMessageSchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string().min(1).max(2000),
});

export const rateConversationSchema = z.object({
  conversationId: z.number().int().positive(),
  score: z.number().int().min(1).max(5),
});

export const escalateConversationSchema = z.object({
  conversationId: z.number().int().positive(),
  reason: z.string().min(1).max(500).optional(),
});

export const createTicketSchema = z.object({
  clientId: z.number().int().positive().optional(),
  conversationId: z.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  subject: z.string().min(1).max(255),
  description: z.string().min(1),
});

export const updateTicketSchema = z.object({
  ticketId: z.number().int().positive(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedToUserId: z.number().int().positive().nullable().optional(),
});

export const addTicketMessageSchema = z.object({
  ticketId: z.number().int().positive(),
  content: z.string().min(1),
  isInternal: z.boolean().default(false),
});

export const listTicketsSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedToMe: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.number().int().positive().optional(),
});

export const upsertTemplateSchema = z.object({
  id: z.number().int().positive().optional(),
  intent: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const supportSuggestionCategorySchema = z.enum([
  'product',
  'ux',
  'performance',
  'financial',
  'support',
  'other',
]);

export const supportSuggestionImpactSchema = z.enum(['low', 'medium', 'high']);

export const supportSuggestionStatusSchema = z.enum([
  'received',
  'reviewing',
  'implemented',
  'rejected',
]);

export const createSupportSuggestionSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(10).max(4000),
  category: supportSuggestionCategorySchema,
  perceivedImpact: supportSuggestionImpactSchema,
});

export const listSupportSuggestionsSchema = z.object({
  status: supportSuggestionStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.number().int().positive().optional(),
});
