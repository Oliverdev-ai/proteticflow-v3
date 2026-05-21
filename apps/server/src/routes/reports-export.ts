import { Router } from 'express';
import { verifyAccessToken } from '../core/auth.js';
import { getActiveTenantForUser } from '../modules/tenants/service.js';
import { checkFeatureAccess } from '../modules/licensing/service.js';
import * as reportsService from '../modules/reports/service.js';

const REPORT_TYPES = new Set<reportsService.ReportsDashboardType>([
  'production',
  'financial',
  'clients',
  'inventory',
]);

function parseReportType(value: unknown): reportsService.ReportsDashboardType | null {
  return typeof value === 'string' && REPORT_TYPES.has(value as reportsService.ReportsDashboardType)
    ? (value as reportsService.ReportsDashboardType)
    : null;
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: start.toISOString(),
    dateTo: now.toISOString(),
  };
}

export const reportsExportRouter = Router();

reportsExportRouter.get('/api/reports/export.csv', async (req, res) => {
  const token = req.cookies?.access_token;
  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const type = parseReportType(req.query.type);
  if (!type) {
    res.status(400).json({ error: 'Invalid report type' });
    return;
  }

  try {
    const payload = await verifyAccessToken(token);
    const membership = await getActiveTenantForUser(payload.sub);
    if (!membership) {
      res.status(403).json({ error: 'No active tenant' });
      return;
    }

    await checkFeatureAccess(membership.tenantId, 'reports');

    const fallback = defaultRange();
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : fallback.dateFrom;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : fallback.dateTo;

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relatorios-${type}.csv"`);
    res.write('\uFEFF');

    for await (const chunk of reportsService.streamDashboardCsv(membership.tenantId, type, {
      dateFrom,
      dateTo,
    })) {
      res.write(chunk);
    }

    res.end();
  } catch {
    if (!res.headersSent) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.end();
  }
});
