import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MailMessage = {
  from?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    encoding?: string;
    contentType?: string;
  }>;
  disableFileAccess?: boolean;
  disableUrlAccess?: boolean;
};

type TransportOptions = {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user?: string;
    pass?: string;
  };
};

const nodemailerMocks = vi.hoisted(() => {
  const sendMail = vi.fn<(message: MailMessage) => Promise<void>>(async () => undefined);
  const createTransport = vi.fn<(options: TransportOptions) => { sendMail: typeof sendMail }>(() => ({ sendMail }));
  return { createTransport, sendMail };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: nodemailerMocks.createTransport,
  },
}));

const originalEnv = { ...process.env };

function setBaseEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://proteticflow:password@127.0.0.1:5432/proteticflow_test',
    JWT_SECRET: 'test-jwt-secret-with-at-least-32-chars',
    SETTINGS_SECRET_KEY: 'test-settings-secret-with-at-least-32-chars',
    ASAAS_WEBHOOK_TOKEN: 'test-asaas-webhook-token',
    SMTP_HOST: '',
    SMTP_PORT: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: '',
    ...overrides,
  };
}

async function loadEmailModule() {
  vi.resetModules();
  return import('./email.js');
}

describe('notifications email transport', () => {
  beforeEach(() => {
    nodemailerMocks.createTransport.mockClear();
    nodemailerMocks.sendMail.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('skips SMTP delivery when SMTP credentials are incomplete', async () => {
    setBaseEnv();
    const { sendEmail } = await loadEmailModule();

    const result = await sendEmail({
      to: 'cliente@example.com',
      subject: 'Relatorio',
      text: 'Seu relatorio esta pronto.',
    });

    expect(result).toEqual({ sent: false });
    expect(nodemailerMocks.createTransport).not.toHaveBeenCalled();
    expect(nodemailerMocks.sendMail).not.toHaveBeenCalled();
  });

  it('sends transactional email through Nodemailer with file and URL access disabled', async () => {
    setBaseEnv({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_USER: 'smtp-user',
      SMTP_PASS: 'smtp-pass',
      SMTP_FROM: 'noreply@example.com',
    });
    const { sendEmail } = await loadEmailModule();

    const result = await sendEmail({
      to: 'cliente@example.com',
      subject: 'Relatorio',
      text: 'Seu relatorio esta pronto.',
      html: '<p>Seu relatorio esta pronto.</p>',
      attachments: [{ filename: 'relatorio.txt', content: 'ok', contentType: 'text/plain' }],
    });

    expect(result).toEqual({ sent: true });
    expect(nodemailerMocks.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass',
      },
    });
    expect(nodemailerMocks.sendMail).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'cliente@example.com',
      subject: 'Relatorio',
      text: 'Seu relatorio esta pronto.',
      html: '<p>Seu relatorio esta pronto.</p>',
      attachments: [{ filename: 'relatorio.txt', content: 'ok', contentType: 'text/plain' }],
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  });
});
