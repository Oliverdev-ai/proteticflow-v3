import { z } from 'zod';
import { router, tenantProcedure, adminProcedure, licensedProcedure } from '../../trpc/trpc.js';
import * as employeeService from './service.js';
import * as timesheetService from './timesheet.js';
import * as performanceService from './performance.js';
import { 
  createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema,
  createSkillSchema, createAssignmentSchema, createCommissionPaymentSchema,
  productionReportSchema, clockInSchema, clockOutSchema, timesheetFilterSchema, monthFilterSchema
} from '@proteticflow/shared';

export const employeeRouter = router({
  // CRUD
  create: licensedProcedure.input(createEmployeeSchema).mutation(({ ctx, input }) =>
    employeeService.createEmployee(ctx.user!.tenantId, input, ctx.user!.id)),

  list: tenantProcedure.input(listEmployeesSchema).query(({ ctx, input }) =>
    employeeService.listEmployees(ctx.user!.tenantId, input)),

  get: tenantProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) =>
    employeeService.getEmployee(ctx.user!.tenantId, input.id)),

  update: tenantProcedure.input(z.object({ id: z.number() }).merge(updateEmployeeSchema)).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return employeeService.updateEmployee(ctx.user!.tenantId, id, data, ctx.user!.id);
  }),

  dismiss: adminProcedure.input(z.object({ id: z.number(), dismissalDate: z.string().datetime() })).mutation(({ ctx, input }) =>
    employeeService.dismissEmployee(ctx.user!.tenantId, input.id, input.dismissalDate, ctx.user!.id)),

  // Skills
  addSkill: tenantProcedure.input(createSkillSchema).mutation(({ ctx, input }) =>
    employeeService.addSkill(ctx.user!.tenantId, input)),

  listSkills: tenantProcedure.input(z.object({ employeeId: z.number() })).query(({ ctx, input }) =>
    employeeService.listSkills(ctx.user!.tenantId, input.employeeId)),

  removeSkill: adminProcedure.input(z.object({ skillId: z.number() })).mutation(({ ctx, input }) =>
    employeeService.removeSkill(ctx.user!.tenantId, input.skillId)),

  // Assignments + Commissions
  assignJob: tenantProcedure.input(createAssignmentSchema).mutation(({ ctx, input }) =>
    employeeService.assignJob(ctx.user!.tenantId, input)),

  listAssignments: tenantProcedure.input(z.object({ employeeId: z.number().optional(), jobId: z.number().optional() })).query(({ ctx, input }) =>
    employeeService.listAssignments(ctx.user!.tenantId, input.employeeId)),

  calculateCommissions: adminProcedure.input(z.object({ dateFrom: z.string(), dateTo: z.string() })).mutation(({ ctx, input }) =>
    employeeService.calculateCommissions(ctx.user!.tenantId, input.dateFrom, input.dateTo)),

  createPayment: adminProcedure.input(createCommissionPaymentSchema).mutation(({ ctx, input }) =>
    employeeService.createCommissionPayment(ctx.user!.tenantId, input, ctx.user!.id)),

  // Relatório
  productionReport: tenantProcedure.input(productionReportSchema).query(({ ctx, input }) =>
    employeeService.getProductionReport(ctx.user!.tenantId, input)),
  commissionDetails: tenantProcedure.input(productionReportSchema).query(({ ctx, input }) =>
    employeeService.getCommissionDetails(ctx.user!.tenantId, input)),

  // Ponto Digital (F31)
  clockIn: tenantProcedure.input(clockInSchema).mutation(({ ctx, input }) =>
    timesheetService.clockIn(ctx.user!.tenantId, input.employeeId, input.date, input.time, input.notes)),

  clockOut: tenantProcedure.input(clockOutSchema).mutation(({ ctx, input }) =>
    timesheetService.clockOut(ctx.user!.tenantId, input.employeeId, input.date, input.time, input.notes)),

  timesheets: tenantProcedure.input(timesheetFilterSchema).query(({ ctx, input }) =>
    timesheetService.listTimesheets(ctx.user!.tenantId, input.employeeId, input.month, input.year)),

  monthlySummary: tenantProcedure.input(monthFilterSchema).query(({ ctx, input }) =>
    timesheetService.getMonthlyHoursSummary(ctx.user!.tenantId, input.employeeId, input.month, input.year)),

  performance: tenantProcedure
    .input(z.object({ employeeId: z.number().int().positive() }))
    .query(({ ctx, input }) => performanceService.getEmployeePerformance(ctx.user!.tenantId, input.employeeId)),
});

