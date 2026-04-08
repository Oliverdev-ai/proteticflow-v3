import { z } from 'zod';

export const createPortalTokenSchema = z.object({
  clientId: z.number().int().positive(),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

export const revokePortalTokenSchema = z.object({
  tokenId: z.number().int().positive(),
});

export const listPortalTokensByClientSchema = z.object({
  clientId: z.number().int().positive(),
});

export const sendPortalLinkSchema = z.object({
  tokenId: z.number().int().positive(),
  email: z.string().email(),
  token: z.string().min(64).max(64),
});

export const getPortalByTokenSchema = z.object({
  token: z.string().min(16).max(256),
});
