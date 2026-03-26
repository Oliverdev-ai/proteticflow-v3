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
  cnpj?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  website?: string | undefined;
}

export interface LabBrandingInput {
  reportHeader?: string | undefined;
  reportFooter?: string | undefined;
  primaryColor: string;
  secondaryColor: string;
}

export interface PrinterSettingsInput {
  printerHost: string;
  printerPort: number;
}

export interface SmtpSettingsInput {
  smtpMode: 'resend_fallback' | 'custom_smtp';
  smtpHost?: string | undefined;
  smtpPort?: number | undefined;
  smtpSecure: boolean;
  smtpUsername?: string | undefined;
  smtpPassword?: string | undefined;
  smtpFromName?: string | undefined;
  smtpFromEmail?: string | undefined;
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
    website: string | null;
    logoUrl: string | null;
  };
  branding: {
    reportHeader: string | null;
    reportFooter: string | null;
    primaryColor: string;
    secondaryColor: string;
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
