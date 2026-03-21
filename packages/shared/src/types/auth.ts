export interface JwtPayload {
  sub: number;         // user.id
  tenantId: number;
  role: string;
  iat: number;
  exp: number;
}

export interface SessionInfo {
  id: number;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  current: boolean;    // true se é a sessão ativa neste request
}

export interface UserPermissions {
  role: string;
  modules: string[];
}
