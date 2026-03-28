import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z.string().max(255).optional(),
});

export const sendMessageSchema = z.object({
  sessionId: z.number().int().positive(),
  content: z.string().min(1).max(4000),
});

export const listSessionsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.number().int().positive().optional(),
});

export const archiveSessionSchema = z.object({
  sessionId: z.number().int().positive(),
});
