import type { ReportType } from '../constants/report-types';

export type ReportOutputKind = 'table' | 'summary' | 'mixed';

export interface ReportDefinition {
  type: ReportType;
  title: string;
  description: string;
  outputKind: ReportOutputKind;
  supportsPdf: boolean;
  supportsCsv: boolean;
  supportsEmail: boolean;
  enabled: boolean;
  dependencyNote?: string;
}

export interface ReportRow {
  [key: string]: string | number | boolean | null;
}

export interface ReportPreviewResult {
  type: ReportType;
  title: string;
  generatedAt: string;
  summary: Record<string, string | number | null>;
  columns: string[];
  rows: ReportRow[];
}

export interface ReportArtifact {
  filename: string;
  mimeType: string;
  base64: string;
}

export interface ReportEmailDispatchResult {
  success: boolean;
  to: string;
  reportType: ReportType;
  attachments: string[];
}
