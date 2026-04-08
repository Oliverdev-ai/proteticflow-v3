import { sendEmail } from '../notifications/email.js';
import { logger } from '../../logger.js';
import type { ReportType } from '@proteticflow/shared';

type ReportEmailAttachment = {
  filename: string;
  mimeType: string;
  base64: string;
};

type SendReportEmailInput = {
  tenantId: number;
  reportType: ReportType;
  to: string;
  attachments: ReportEmailAttachment[];
};

export async function sendReportByEmail(input: SendReportEmailInput) {
  try {
    const result = await sendEmail({
      to: input.to,
      subject: `Relatório: ${input.reportType}`,
      text: 'Segue o relatório solicitado em anexo.',
      attachments: input.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.base64,
        encoding: 'base64',
        contentType: attachment.mimeType,
      })),
    });

    logger.info(
      {
        action: 'reports.email.sent',
        tenantId: input.tenantId,
        reportType: input.reportType,
        to: input.to,
        sent: result.sent,
      },
      'Email de relatório enviado',
    );

    return { success: result.sent };
  } catch (err) {
    logger.error(
      { action: 'reports.email.error', tenantId: input.tenantId, reportType: input.reportType, to: input.to, err },
      'Falha ao enviar email de relatório',
    );

    return { success: false };
  }
}
