import { logger } from '../../logger.js';
import { env } from '../../env.js';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
}

export async function sendEmail(payload: EmailPayload) {
  if (!hasSmtpConfig()) {
    logger.warn(
      { action: 'notifications.email.skipped', to: payload.to, subject: payload.subject },
      'SMTP nao configurado. Email nao enviado.',
    );
    return { sent: false };
  }

  // Stub de envio sem dependencia externa.
  logger.info(
    { action: 'notifications.email.stub_send', to: payload.to, subject: payload.subject },
    'Email transacional preparado para envio',
  );

  return { sent: true };
}

export async function sendInviteEmail(to: string, inviteToken: string) {
  return sendEmail({
    to,
    subject: 'Convite para o ProteticFlow',
    text: `Voce recebeu um convite para acessar o laboratorio no ProteticFlow. Token: ${inviteToken}`,
  });
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  return sendEmail({
    to,
    subject: 'Reset de senha no ProteticFlow',
    text: `Use este token para resetar sua senha: ${resetToken}`,
  });
}

export async function sendReportEmail(to: string, reportName: string) {
  return sendEmail({
    to,
    subject: `Relatorio disponivel: ${reportName}`,
    text: `O relatorio ${reportName} foi processado e esta disponivel no sistema.`,
  });
}
