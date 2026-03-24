export interface SettingsUserItem {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: 'superadmin' | 'gerente' | 'producao' | 'recepcao' | 'contabil';
  isActive: boolean;
  joinedAt: string;
  lastSignedIn: string | null;
}

export interface LabIdentityInput {
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface LabBrandingInput {
  reportHeader?: string;
  reportFooter?: string;
  primaryColor: string;
  secondaryColor: string;
  website?: string;
}

export interface PrinterSettingsInput {
  printerHost: string;
  printerPort: number;
}

export interface SmtpSettingsInput {
  smtpMode: 'resend_fallback' | 'custom_smtp';
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
}

export interface SettingsOverview {
  tenantId: number;
  identity: {
    name: string;
    cnpj: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    logoUrl: string | null;
  };
  branding: {
    reportHeader: string | null;
    reportFooter: string | null;
    primaryColor: string;
    secondaryColor: string;
    website: string | null;
  };
  printer: {
    printerHost: string | null;
    printerPort: number | null;
  };
  smtp: {
    smtpMode: 'resend_fallback' | 'custom_smtp';
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUsername: string | null;
    smtpFromName: string | null;
    smtpFromEmail: string | null;
    hasPassword: boolean;
    lastSmtpTestAt: string | null;
    lastSmtpTestStatus: 'ok' | 'failed' | null;
  };
  plan: {
    current: 'trial' | 'starter' | 'pro' | 'enterprise';
    planExpiresAt: string | null;
    clientCount: number;
    jobCountThisMonth: number;
    userCount: number;
    priceTableCount: number;
    storageUsedMb: number;
  };
  users?: SettingsUserItem[];
}
