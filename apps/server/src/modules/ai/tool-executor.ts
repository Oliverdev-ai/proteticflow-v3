import { TRPCError } from '@trpc/server';
import {
  agendaTodaySchema,
  createClientSchema,
  createEventSchema,
  createPurchaseSchema,
  createReworkSchema,
  deliveriesRouteByDaySchema,
  employeesProductivitySchema,
  financialExpensesToDateSchema,
  financialQuarterlyReportSchema,
  financialRevenueToDateSchema,
  jobsOverdueSchema,
  jobsStatusUpdateSchema,
  listArSchema,
  listClientsSchema,
  listJobsSchema,
  messagesDraftToClientSchema,
  stockAlertsSchema,
  stockCheckMaterialSchema,
  suspendJobSchema,
  toggleUrgentSchema,
  type Role,
} from '@proteticflow/shared';
import { z } from 'zod';
import type { AbcCurveInput } from '../reports/abc-curve.validators.js';
import { abcCurveInputSchema } from '../reports/abc-curve.validators.js';
import { generateAbcCurveReport } from '../reports/abc-curve.service.js';
import { getDashboardSummary } from '../dashboard/service.js';
import { parseNaturalDate } from './resolvers.js';
import {
  FLOW_COMMANDS,
  checkCommandAccess,
  resolveAction,
  type FlowCommandName,
  type RiskLevel,
} from './command-parser.js';
import * as agendaService from '../agenda/service.js';
import * as clientService from '../clients/service.js';
import * as deliveryService from '../deliveries/service.js';
import * as financialService from '../financial/service.js';
import * as jobService from '../jobs/service.js';
import * as purchaseService from '../purchases/service.js';
import {
  buildFinancialCloseAccountPreviewStep,
  executeFinancialExpensesToDate,
  buildFinancialMonthlyClosingPreviewStep,
  executeFinancialCloseAccount,
  executeFinancialMonthlyClosing,
  executeFinancialQuarterlyReport,
  executeFinancialRevenueToDate,
  financialCloseAccountToolSchema,
  financialMonthlyClosingToolSchema,
} from './tools/financial-tools.js';
import { executeDeliveriesRouteByDay } from './tools/deliveries-tools.js';
import { executeEmployeesProductivity } from './tools/employees-tools.js';
import { executeAgendaToday } from './tools/agenda-tools.js';
import {
  buildJobsStatusUpdatePreviewStep,
  executeJobsOverdue,
  executeJobsStatusUpdate,
} from './tools/jobs-tools.js';
import {
  buildMessagesDraftToClientPreviewStep,
  executeMessagesDraftToClient,
} from './tools/messages-tools.js';
import {
  buildPayrollGeneratePreviewStep,
  executePayrollGenerate,
  payrollGenerateToolSchema,
} from './tools/payroll-tools.js';
import {
  buildPurchaseReceivePreviewStep,
  executePurchaseReceive,
  purchasesReceiveToolSchema,
} from './tools/purchase-tools.js';
import {
  executeStockAlerts,
  executeStockCheckMaterial,
} from './tools/stock-tools.js';

const jobsGetSchema = z.object({
  jobId: z.coerce.number().int().positive(),
});

const jobsListPendingSchema = listJobsSchema.partial().extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const jobsFinalizeSchema = z.object({
  jobId: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

const jobsCreateDraftSchema = z.object({
  clientId: z.coerce.number().int().positive().optional(),
  clientName: z.string().min(2).optional(),
  serviceId: z.coerce.number().int().positive().optional(),
  serviceName: z.string().min(2).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPriceCents: z.coerce.number().int().min(0).default(0),
  patientName: z.string().max(255).optional(),
  notes: z.string().optional(),
  isUrgent: z.boolean().default(false),
  deadline: z.string().min(1),
});

const deliveriesTodaySchema = z.object({
  date: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const clientsSearchSchema = z.object({
  term: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const clientsCreateDraftSchema = z.object({
  name: z.string().min(3),
  clinic: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const purchasesCreateSchema = z.object({
  supplierId: z.coerce.number().int().positive(),
  items: z.array(z.object({
    materialId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive(),
    unitPriceCents: z.coerce.number().int().positive(),
  })).min(1),
  notes: z.string().optional(),
});

const commonDateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const accountsReceivableSchema = listArSchema.partial().extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ToolContext = {
  tenantId: number;
  userId: number;
  role: Role;
  sessionId?: number | undefined;
};

export type CommandPreview = {
  title: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
};

export type ConfirmationStep =
  | {
    type: 'disambiguate';
    field: string;
    options: Array<{ id: number; label: string; detail?: string }>;
  }
  | {
    type: 'fill_missing';
    fields: Array<{ name: string; label: string; type: string; required: boolean }>;
  }
  | {
    type: 'review';
    preview: CommandPreview;
  }
  | {
    type: 'confirm';
    warning: string;
    action: string;
    preview?: CommandPreview;
  };

type PreviewStepBuildResult = {
  step: ConfirmationStep;
  preview: CommandPreview;
  resolvedInput?: unknown;
};

export type ToolHandler<TInput = unknown, TOutput = unknown> = {
  name: FlowCommandName;
  inputSchema: z.ZodType<TInput>;
  buildPreviewStep?: (
    ctx: ToolContext,
    input: TInput,
    riskLevel: RiskLevel,
  ) => Promise<PreviewStepBuildResult>;
  execute: (ctx: ToolContext, input: TInput) => Promise<TOutput>;
};

type GenericToolHandler = ToolHandler<unknown, unknown>;

export type ToolExecutionResult =
  | {
    status: 'awaiting_confirmation';
    riskLevel: RiskLevel;
    preview: CommandPreview;
    step: ConfirmationStep;
    validatedInput: unknown;
  }
  | {
    status: 'success';
    riskLevel: RiskLevel;
    output: unknown;
    validatedInput: unknown;
  };

function isoTodayRange(baseDate?: string): { start: string; end: string } {
  const base = baseDate ? new Date(baseDate) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isoMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function buildPreview(command: FlowCommandName, input: unknown, riskLevel: RiskLevel): CommandPreview {
  const safeInput = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  const title = `Confirmar comando: ${command}`;
  const summary = riskLevel === 'critical'
    ? 'Acao critica detectada. Revise os dados antes de confirmar.'
    : 'Acao transacional detectada. Revise os dados antes de confirmar.';

  const details = Object.entries(safeInput)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 8)
    .map(([label, value]) => ({
      label,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));

  return { title, summary, details };
}

function buildDefaultConfirmationStep(
  command: FlowCommandName,
  input: unknown,
  riskLevel: RiskLevel,
): PreviewStepBuildResult {
  const preview = buildPreview(command, input, riskLevel);
  if (riskLevel === 'critical') {
    return {
      preview,
      step: {
        type: 'confirm',
        warning: 'Acao critica. Revise o resumo antes de confirmar.',
        action: `Confirmar ${command}`,
        preview,
      },
    };
  }

  return {
    preview,
    step: {
      type: 'review',
      preview,
    },
  };
}

export const TOOL_REGISTRY: Record<FlowCommandName, GenericToolHandler> = {
  'jobs.listPending': {
    name: 'jobs.listPending',
    inputSchema: jobsListPendingSchema,
    execute: async (ctx, input) => {
      const parsed = jobsListPendingSchema.parse(input);
      return jobService.listJobs(ctx.tenantId, {
        search: parsed.search,
        clientId: parsed.clientId,
        overdue: parsed.overdue,
        cursor: parsed.cursor,
        limit: parsed.limit,
      status: 'pending',
      });
    },
  },
  'jobs.getById': {
    name: 'jobs.getById',
    inputSchema: jobsGetSchema,
    execute: async (ctx, input) => {
      const parsed = jobsGetSchema.parse(input);
      return jobService.getJob(ctx.tenantId, parsed.jobId);
    },
  },
  'deliveries.listToday': {
    name: 'deliveries.listToday',
    inputSchema: deliveriesTodaySchema,
    execute: async (ctx, input) => {
      const parsed = deliveriesTodaySchema.parse(input);
      const range = isoTodayRange(parsed.date);
      return deliveryService.listSchedules(ctx.tenantId, {
        page: parsed.page,
        limit: parsed.limit,
        dateFrom: range.start,
        dateTo: range.end,
      });
    },
  },
  'deliveries.routeByDay': {
    name: 'deliveries.routeByDay',
    inputSchema: deliveriesRouteByDaySchema,
    execute: async (ctx, input) =>
      executeDeliveriesRouteByDay(ctx, deliveriesRouteByDaySchema.parse(input)),
  },
  'stock.checkMaterial': {
    name: 'stock.checkMaterial',
    inputSchema: stockCheckMaterialSchema,
    execute: async (ctx, input) =>
      executeStockCheckMaterial(ctx, stockCheckMaterialSchema.parse(input)),
  },
  'stock.alerts': {
    name: 'stock.alerts',
    inputSchema: stockAlertsSchema,
    execute: async (ctx, input) =>
      executeStockAlerts(ctx, stockAlertsSchema.parse(input)),
  },
  'clients.search': {
    name: 'clients.search',
    inputSchema: clientsSearchSchema,
    execute: async (ctx, input) => {
      const parsed = clientsSearchSchema.parse(input);
      return clientService.listClients(ctx.tenantId, {
        page: parsed.page,
        limit: parsed.limit,
        search: parsed.term,
      });
    },
  },
  'clients.list': {
    name: 'clients.list',
    inputSchema: listClientsSchema.partial().extend({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
    execute: async (ctx, input) => clientService.listClients(
      ctx.tenantId,
      input as z.infer<typeof listClientsSchema>,
    ),
  },
  'analytics.monthSummary': {
    name: 'analytics.monthSummary',
    inputSchema: z.object({}),
    execute: async (ctx) => getDashboardSummary(ctx.tenantId),
  },
  'reports.abcCurve': {
    name: 'reports.abcCurve',
    inputSchema: abcCurveInputSchema.partial().extend({
      type: abcCurveInputSchema.shape.type.default('services'),
    }),
    execute: async (ctx, input) => {
      const parsed = (input as Partial<AbcCurveInput>);
      const range = isoMonthRange();
      return generateAbcCurveReport(ctx.tenantId, {
        type: parsed.type ?? 'services',
        startDate: parsed.startDate ?? range.start,
        endDate: parsed.endDate ?? range.end,
      });
    },
  },
  'reports.accountsReceivable': {
    name: 'reports.accountsReceivable',
    inputSchema: accountsReceivableSchema,
    execute: async (ctx, input) => financialService.listAr(
      ctx.tenantId,
      input as z.infer<typeof listArSchema>,
    ),
  },
  'ai.productionEstimate': {
    name: 'ai.productionEstimate',
    inputSchema: z.object({}),
    execute: async (ctx) => {
      const dashboard = await getDashboardSummary(ctx.tenantId);
      return {
        activeJobs: dashboard.jobs.active,
        pendingJobs: dashboard.jobs.pending,
        overdueJobs: dashboard.jobs.overdue,
      };
    },
  },
  'analytics.revenueForecast': {
    name: 'analytics.revenueForecast',
    inputSchema: commonDateRangeSchema,
    execute: async (ctx) => {
      const summary = await financialService.getDashboardSummary(ctx.tenantId);
      return {
        totalReceivableCents: summary.totalReceivableCents,
        totalPayableCents: summary.totalPayableCents,
        overdueCents: summary.overdueCents,
        monthFlowCents: summary.monthFlowCents,
      };
    },
  },
  'employees.productivity': {
    name: 'employees.productivity',
    inputSchema: employeesProductivitySchema,
    execute: async (ctx, input) =>
      executeEmployeesProductivity(ctx, employeesProductivitySchema.parse(input)),
  },
  'jobs.createDraft': {
    name: 'jobs.createDraft',
    inputSchema: jobsCreateDraftSchema,
    execute: async (ctx, input) => {
      const parsed = jobsCreateDraftSchema.parse(input);
      const deadlineDate = parseNaturalDate(parsed.deadline);

      const clientId = parsed.clientId;
      if (!clientId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'clientId e obrigatorio para criar OS' });
      }

      const serviceName = parsed.serviceName ?? 'Servico geral';
      return jobService.createJob(ctx.tenantId, {
        clientId,
        deadline: deadlineDate.toISOString(),
        patientName: parsed.patientName,
        notes: parsed.notes,
        isUrgent: parsed.isUrgent,
        items: [{
          priceItemId: parsed.serviceId,
          serviceNameSnapshot: serviceName,
          quantity: parsed.quantity,
          unitPriceCents: parsed.unitPriceCents,
          adjustmentPercent: 0,
        }],
      }, ctx.userId);
    },
  },
  'jobs.finalize': {
    name: 'jobs.finalize',
    inputSchema: jobsFinalizeSchema,
    execute: async (ctx, input) => {
      const parsed = jobsFinalizeSchema.parse(input);
      return jobService.changeStatus(ctx.tenantId, {
        jobId: parsed.jobId,
        newStatus: 'delivered',
        notes: parsed.notes,
      }, ctx.userId);
    },
  },
  'jobs.suspend': {
    name: 'jobs.suspend',
    inputSchema: suspendJobSchema,
    execute: async (ctx, input) => jobService.suspendJob(
      ctx.tenantId,
      suspendJobSchema.parse(input),
      ctx.userId,
    ),
  },
  'jobs.toggleUrgent': {
    name: 'jobs.toggleUrgent',
    inputSchema: toggleUrgentSchema,
    execute: async (ctx, input) => jobService.toggleJobUrgent(
      ctx.tenantId,
      toggleUrgentSchema.parse(input),
      ctx.userId,
    ),
  },
  'jobs.createRework': {
    name: 'jobs.createRework',
    inputSchema: createReworkSchema,
    execute: async (ctx, input) => jobService.createReworkJob(
      ctx.tenantId,
      createReworkSchema.parse(input),
      ctx.userId,
    ),
  },
  'agenda.createEvent': {
    name: 'agenda.createEvent',
    inputSchema: createEventSchema,
    execute: async (ctx, input) => agendaService.createEvent(
      ctx.tenantId,
      createEventSchema.parse(input),
      ctx.userId,
    ),
  },
  'agenda.today': {
    name: 'agenda.today',
    inputSchema: agendaTodaySchema,
    execute: async (ctx, input) =>
      executeAgendaToday(ctx, agendaTodaySchema.parse(input)),
  },
  'jobs.overdue': {
    name: 'jobs.overdue',
    inputSchema: jobsOverdueSchema,
    execute: async (ctx, input) =>
      executeJobsOverdue(ctx, jobsOverdueSchema.parse(input)),
  },
  'jobs.statusUpdate': {
    name: 'jobs.statusUpdate',
    inputSchema: jobsStatusUpdateSchema,
    buildPreviewStep: async (ctx, input) =>
      buildJobsStatusUpdatePreviewStep(ctx, jobsStatusUpdateSchema.parse(input)),
    execute: async (ctx, input) =>
      executeJobsStatusUpdate(ctx, jobsStatusUpdateSchema.parse(input)),
  },
  'messages.draftToClient': {
    name: 'messages.draftToClient',
    inputSchema: messagesDraftToClientSchema,
    buildPreviewStep: async (ctx, input) =>
      buildMessagesDraftToClientPreviewStep(ctx, messagesDraftToClientSchema.parse(input)),
    execute: async (ctx, input) =>
      executeMessagesDraftToClient(ctx, messagesDraftToClientSchema.parse(input)),
  },
  'clients.createDraft': {
    name: 'clients.createDraft',
    inputSchema: clientsCreateDraftSchema,
    execute: async (ctx, input) => clientService.createClient(
      ctx.tenantId,
      createClientSchema.parse(input),
      ctx.userId,
    ),
  },
  'purchases.create': {
    name: 'purchases.create',
    inputSchema: purchasesCreateSchema,
    execute: async (ctx, input) => purchaseService.createPurchase(
      ctx.tenantId,
      createPurchaseSchema.parse(input),
      ctx.userId,
    ),
  },
  'financial.closeAccount': {
    name: 'financial.closeAccount',
    inputSchema: financialCloseAccountToolSchema,
    buildPreviewStep: async (ctx, input) =>
      buildFinancialCloseAccountPreviewStep(ctx, financialCloseAccountToolSchema.parse(input)),
    execute: async (ctx, input) =>
      executeFinancialCloseAccount(ctx, financialCloseAccountToolSchema.parse(input)),
  },
  'financial.monthlyClosing': {
    name: 'financial.monthlyClosing',
    inputSchema: financialMonthlyClosingToolSchema,
    buildPreviewStep: async (ctx, input) =>
      buildFinancialMonthlyClosingPreviewStep(ctx, financialMonthlyClosingToolSchema.parse(input)),
    execute: async (ctx, input) =>
      executeFinancialMonthlyClosing(ctx, financialMonthlyClosingToolSchema.parse(input)),
  },
  'financial.revenueToDate': {
    name: 'financial.revenueToDate',
    inputSchema: financialRevenueToDateSchema,
    execute: async (ctx, input) =>
      executeFinancialRevenueToDate(ctx, financialRevenueToDateSchema.parse(input)),
  },
  'financial.expensesToDate': {
    name: 'financial.expensesToDate',
    inputSchema: financialExpensesToDateSchema,
    execute: async (ctx, input) =>
      executeFinancialExpensesToDate(ctx, financialExpensesToDateSchema.parse(input)),
  },
  'financial.quarterlyReport': {
    name: 'financial.quarterlyReport',
    inputSchema: financialQuarterlyReportSchema,
    execute: async (ctx, input) =>
      executeFinancialQuarterlyReport(ctx, financialQuarterlyReportSchema.parse(input)),
  },
  'payroll.generate': {
    name: 'payroll.generate',
    inputSchema: payrollGenerateToolSchema,
    buildPreviewStep: async (ctx, input) =>
      buildPayrollGeneratePreviewStep(ctx, payrollGenerateToolSchema.parse(input)),
    execute: async (ctx, input) =>
      executePayrollGenerate(ctx, payrollGenerateToolSchema.parse(input)),
  },
  'purchases.receive': {
    name: 'purchases.receive',
    inputSchema: purchasesReceiveToolSchema,
    buildPreviewStep: async (ctx, input) =>
      buildPurchaseReceivePreviewStep(ctx, purchasesReceiveToolSchema.parse(input)),
    execute: async (ctx, input) =>
      executePurchaseReceive(ctx, purchasesReceiveToolSchema.parse(input)),
  },
};

export type ExecuteToolOptions = {
  confirmed?: boolean;
  source?: 'manual' | 'llm' | 'resolve_step' | 'confirm';
  idempotencyKey?: string;
};

export async function executeTool(
  ctx: ToolContext,
  command: FlowCommandName,
  rawInput: unknown,
  options?: ExecuteToolOptions,
): Promise<ToolExecutionResult> {
  if (!checkCommandAccess(command, ctx.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissao para executar este comando' });
  }

  const tool = TOOL_REGISTRY[command];
  if (!tool) {
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: `Comando ${command} nao implementado` });
  }

  const validatedInput = tool.inputSchema.parse(rawInput);
  const riskLevel = FLOW_COMMANDS[command].risk;
  const action = resolveAction(riskLevel);

  if (!options?.confirmed && action !== 'execute') {
    const previewBuild = tool.buildPreviewStep
      ? await tool.buildPreviewStep(ctx, validatedInput, riskLevel)
      : buildDefaultConfirmationStep(command, validatedInput, riskLevel);

    const nextInput = previewBuild.resolvedInput ?? validatedInput;
    return {
      status: 'awaiting_confirmation',
      riskLevel,
      preview: previewBuild.preview,
      step: previewBuild.step,
      validatedInput: nextInput,
    };
  }

  const output = await tool.execute(ctx, validatedInput);
  return {
    status: 'success',
    riskLevel,
    output,
    validatedInput,
  };
}

export async function confirmAndExecute(
  ctx: ToolContext,
  command: FlowCommandName,
  rawInput: unknown,
  options?: Omit<ExecuteToolOptions, 'confirmed'>,
): Promise<ToolExecutionResult> {
  return executeTool(ctx, command, rawInput, {
    ...(options ?? {}),
    confirmed: true,
  });
}
