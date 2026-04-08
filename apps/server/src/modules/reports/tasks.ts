import { runWithRetry } from '../../core/jobs.js';
import { sendReportByEmail } from './email.js';
import type { ReportType } from '@proteticflow/shared';

type Attachment = {
  filename: string;
  mimeType: string;
  base64: string;
};

export async function reportEmailDispatch(payload: {
  tenantId: number;
  reportType: ReportType;
  to: string;
  attachments: Attachment[];
}) {
  return runWithRetry(() => sendReportByEmail(payload), 2, 400);
}

export async function reportArtifactPrune(artifacts: Array<{ filename: string }>) {
  return {
    pruned: artifacts.length,
    filenames: artifacts.map((artifact) => artifact.filename),
  };
}
