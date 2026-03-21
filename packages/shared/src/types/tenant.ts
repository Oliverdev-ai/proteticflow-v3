import type { Role } from '../constants/roles';

export interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  plan: string;
  role: Role;       // role do user NESTE tenant (de tenant_members)
  logoUrl: string | null;
}

export interface TenantMember {
  id: number;       // tenant_members.id
  userId: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  joinedAt: string;
  lastSignedIn: string | null;
}

export interface PendingInvite {
  id: number;
  email: string;
  role: Role;
  status: string;
  expiresAt: string;
  createdAt: string;
}
