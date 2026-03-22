import { z } from 'zod';
import { router, tenantProcedure, adminProcedure, licensedProcedure } from '../../trpc/trpc.js';
import * as employeeService from './service.js';
import { 
  createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema,
  createSkillSchema, createAssignmentSchema, createCommissionPaymentSchema,
  productionReportSchema
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

  // Atribuições
  assignJob: tenantProcedure.input(createAssignmentSchema).mutation(({ ctx, input }) =>
    employeeService.assignJob(ctx.user!.tenantId, input)),

  listAssignments: tenantProcedure.input(z.object({ employeeId: z.number() })).query(({ ctx, input }) =>
    employeeService.listAssignments(ctx.user!.tenantId, input.employeeId)),

  // Comissões
  calculateCommissions: tenantProcedure.input(productionReportSchema).query(({ ctx, input }) =>
    employeeService.calculateCommissions(ctx.user!.tenantId, input)),

  payCommissions: adminProcedure.input(createCommissionPaymentSchema).mutation(({ ctx, input }) =>
    employeeService.payCommissions(ctx.user!.tenantId, input, ctx.user!.id)),
});
