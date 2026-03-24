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
  logger.info(
    {
      action: 'reports.email.dispatch',
      tenantId: input.tenantId,
      reportType: input.reportType,
      to: input.to,
      attachments: input.attachments.map((item) => item.filename),
    },
    'Dispatch de relatorio por email executado (stub)',
  );

  return { success: true };
}
