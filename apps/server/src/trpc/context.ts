import type { Request, Response } from 'express';
import type { db } from '../db/index.js';

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
};

export function createContext(
  dbInstance: typeof db,
): (opts: { req: Request; res: Response }) => TrpcContext {
  return ({ req, res }) => ({
    req,
    res,
    db: dbInstance,
    user: null, // preenchido pelo middleware JWT na Fase 2
  });
}
