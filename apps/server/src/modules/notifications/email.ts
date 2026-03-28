import { logger } from '../../logger.js';
import { env } from '../../env.js';
import nodemailer from 'nodemailer';

type EmailPayload = {
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

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    attachments: payload.attachments,
  });

  logger.info(
    { action: 'notifications.email.sent', to: payload.to, subject: payload.subject },
    'Email transacional enviado',
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
