import rateLimit from 'express-rate-limit';
import { env } from '../env.js';

function getRequestIp(xForwardedFor: string | string[] | undefined, fallback: string | undefined): string {
  if (Array.isArray(xForwardedFor)) {
    return xForwardedFor[0] ?? fallback ?? 'unknown';
  }
  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
    return xForwardedFor.split(',')[0]?.trim() ?? fallback ?? 'unknown';
  }
  return fallback ?? 'unknown';
}

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 200 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
  keyGenerator: (req) => getRequestIp(req.headers['x-forwarded-for'], req.socket.remoteAddress),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  keyGenerator: (req) => getRequestIp(req.headers['x-forwarded-for'], req.socket.remoteAddress),
});
