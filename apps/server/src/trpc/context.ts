import type { Request, Response } from 'express';
import type { db } from '../db/index.js';
import { verifyAccessToken } from '../core/auth.js';

export type TrpcUser = {
  id: number;
  tenantId: number;
  role: string;
};

export type TrpcContext = {
  req: Request;
  res: Response;
  db: typeof db;
  user: TrpcUser | null;
  tenantId: number | null;
};

export function createContext(
  dbInstance: typeof db,
) {
  return async ({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> => {
    let user = null;
    let tenantId = null;

    if (req.cookies && req.cookies.access_token) {
      try {
        const payload = await verifyAccessToken(req.cookies.access_token);
        if (payload) {
          user = {
            id: payload.sub,
            tenantId: payload.tenantId,
            role: payload.role,
          };
          tenantId = payload.tenantId || null;
        }
      } catch (err) {
        // silencia erro de token inválido/expirado
      }
    }

    return {
      req,
      res,
      db: dbInstance,
      user,
      tenantId,
    };
  };
}
