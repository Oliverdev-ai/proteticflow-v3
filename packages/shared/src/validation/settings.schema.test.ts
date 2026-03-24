import { describe, expect, it } from 'vitest';
import {
  settingsOverviewSchema,
  updateLabBrandingSchema,
  updateSmtpSettingsSchema,
} from './settings.schema';

describe('settings.schema', () => {
  it('aceita payload valido', () => {
    const parsed = updateLabBrandingSchema.parse({
      primaryColor: '#112233',
      secondaryColor: '#AABBCC',
      reportHeader: 'Header',
    });
    expect(parsed.primaryColor).toBe('#112233');
  });

  it('rejeita cor invalida', () => {
    const result = updateLabBrandingSchema.safeParse({
      primaryColor: '112233',
      secondaryColor: '#AABBCC',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita email invalido', () => {
    const result = updateSmtpSettingsSchema.safeParse({
      smtpMode: 'custom_smtp',
      smtpSecure: false,
      smtpFromEmail: 'invalido',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita porta invalida', () => {
    const result = updateSmtpSettingsSchema.safeParse({
      smtpMode: 'custom_smtp',
      smtpSecure: false,
      smtpPort: 70000,
    });
    expect(result.success).toBe(false);
  });

  it('garante que output nao expoe senha', () => {
    const parsed = settingsOverviewSchema.parse({
      tenantId: 1,
      identity: { name: 'Lab', cnpj: null, phone: null, email: null, address: null, city: null, state: null, logoUrl: null },
      branding: { reportHeader: null, reportFooter: null, primaryColor: '#112233', secondaryColor: '#445566', website: null },
      printer: { printerHost: null, printerPort: null },
      smtp: {
        smtpMode: 'custom_smtp',
        smtpHost: null,
        smtpPort: null,
        smtpSecure: false,
        smtpUsername: null,
        smtpFromName: null,
        smtpFromEmail: null,
        hasPassword: true,
        lastSmtpTestAt: null,
        lastSmtpTestStatus: null,
      },
      plan: {
        current: 'trial',
        planExpiresAt: null,
        clientCount: 0,
        jobCountThisMonth: 0,
        userCount: 0,
        priceTableCount: 0,
        storageUsedMb: 0,
      },
    });

    expect('smtpPassword' in parsed.smtp).toBe(false);
    expect('smtpPasswordEncrypted' in parsed.smtp).toBe(false);
  });
});
