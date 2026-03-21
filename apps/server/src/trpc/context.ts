import type { Request, Response } from 'express';
import type { db } from '../db/index.js';
import { verifyAccessToken } from '../core/auth.js';
import { getActiveTenantForUser } from '../modules/tenants/service.js';
import type { Role } from '@proteticflow/shared';

export type TrpcUser = {
  id: number;
  tenantId: number;
  role: Role;    // role do tenant_members (5 roles PRD), não o global users.role
};

export type TrpcContext = {
  req: Request;
  res: Response;
  db: typeof db;
  user: TrpcUser | null;
  tenantId: number | null;
};

export function createContext(dbInstance: typeof db) {
  return async ({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> => {
    let user: TrpcUser | null = null;
    let tenantId: number | null = null;

    if (req.cookies?.access_token) {
      try {
        const payload = await verifyAccessToken(req.cookies.access_token);

        // Resolve o role REAL do tenant_members (não o do JWT que pode estar stale)
        const membership = await getActiveTenantForUser(payload.sub);

        if (membership) {
          user = {
            id: payload.sub,
            tenantId: membership.tenantId,
            role: membership.role,
          };
          tenantId = membership.tenantId;
        } else {
          // Autenticado mas sem tenant ativo — redirecionar para onboarding no frontend
          user = {
            id: payload.sub,
            tenantId: 0,
            role: 'recepcao', // fallback — só funciona em protectedProcedure simples
          };
          tenantId = null;
        }
      } catch {
        // token inválido/expirado — user permanece null
      }
    }

    return { req, res, db: dbInstance, user, tenantId };
  };
}
