export type AuditLogEntry = {
  id: number;
  tenantId: number;
  userId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
};

export type TenantUsageSummary = {
  tenantId: number;
  plan: string;
  clients: { used: number; limit: number | null };
  jobsThisMonth: { used: number; limit: number | null };
  users: { used: number; limit: number | null };
  priceTables: { used: number; limit: number | null };
  storageMb: { used: number; limit: number | null };
};

export type BlockMemberInput = {
  userId: number;
  reason: string;
};

export type ListAuditLogsInput = {
  entityType?: string | undefined;
  action?: string | undefined;
  userId?: number | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};
