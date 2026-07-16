import rateLimit from 'express-rate-limit';
import { env } from '../env.js';

export function buildGlobalLimiterOptions() {
  return {
    windowMs: 60 * 1000,
    limit: env.NODE_ENV === 'production' ? 200 : 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em instantes.' },
  } satisfies Parameters<typeof rateLimit>[0];
}

export function buildAuthLimiterOptions() {
  return {
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  } satisfies Parameters<typeof rateLimit>[0];
}

export const globalLimiter = rateLimit(buildGlobalLimiterOptions());

export const authLimiter = rateLimit(buildAuthLimiterOptions());
