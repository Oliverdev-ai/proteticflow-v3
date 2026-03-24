import { router } from './trpc.js';
import { authRouter } from '../modules/auth/router.js';
import { tenantRouter } from '../modules/tenants/router.js';
import { clientRouter } from '../modules/clients/router.js';
import { pricingRouter } from '../modules/pricing/router.js';
import { jobRouter } from '../modules/jobs/router.js';
import { financialRouter } from '../modules/financial/router.js';
import { deliveryRouter } from '../modules/deliveries/router.js';
import { inventoryRouter } from '../modules/inventory/router.js';
import { employeeRouter } from '../modules/employees/router.js';
import { payrollRouter } from '../modules/payroll/router.js';
import { scanRouter } from '../modules/scans/router.js';
import { agendaRouter } from '../modules/agenda/router.js';
import { aiRouter } from '../modules/ai/router.js';

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
  client: clientRouter,
  pricing: pricingRouter,
  job: jobRouter,
  financial: financialRouter,
  delivery: deliveryRouter,
  inventory: inventoryRouter,
  employee: employeeRouter,
  payroll: payrollRouter,
  scan: scanRouter,
  agenda: agendaRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
