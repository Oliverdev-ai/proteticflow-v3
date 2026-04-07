export const REPORT_TYPES = [
  'monthly_closing',
  'jobs_by_period',
  'productivity',
  'quarterly_annual',
  'inventory',
  'deliveries',
  'purchases',
  'fiscal-revenue',
  'fiscal-expenses',
  'fiscal-dre',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
