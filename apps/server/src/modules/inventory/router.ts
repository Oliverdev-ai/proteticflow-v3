import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { tenantProcedure, adminProcedure, licensedProcedure } from '../../trpc/middleware.js';
import * as inventoryService from './service.js';
import {
  createCategorySchema, updateCategorySchema,
  createSupplierSchema, updateSupplierSchema, listSuppliersSchema,
  createMaterialSchema, updateMaterialSchema, listMaterialsSchema,
  createMovementSchema, listMovementsSchema,
  createPurchaseOrderSchema, updatePurchaseOrderSchema, listPurchaseOrdersSchema,
  changePurchaseOrderStatusSchema,
} from '@proteticflow/shared';

export const inventoryRouter = router({
  // ── Categorias
  createCategory:  adminProcedure.input(createCategorySchema).mutation(({ ctx, input }) =>
    inventoryService.createCategory(ctx.user.tenantId, input)),
  listCategories:  tenantProcedure.query(({ ctx }) =>
    inventoryService.listCategories(ctx.user.tenantId)),
  updateCategory:  adminProcedure.input(z.object({ id: z.number() }).merge(updateCategorySchema)).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return inventoryService.updateCategory(ctx.user.tenantId, id, data);
  }),
  deleteCategory:  adminProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) =>
    inventoryService.deleteCategory(ctx.user.tenantId, input.id)),

  // ── Fornecedores
  createSupplier:  licensedProcedure.input(createSupplierSchema).mutation(({ ctx, input }) =>
    inventoryService.createSupplier(ctx.user.tenantId, input)),
  listSuppliers:   tenantProcedure.input(listSuppliersSchema).query(({ ctx, input }) =>
    inventoryService.listSuppliers(ctx.user.tenantId, input)),
  getSupplier:     tenantProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) =>
    inventoryService.getSupplier(ctx.user.tenantId, input.id)),
  updateSupplier:  tenantProcedure.input(z.object({ id: z.number() }).merge(updateSupplierSchema)).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return inventoryService.updateSupplier(ctx.user.tenantId, id, data);
  }),
  toggleSupplier:  adminProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) =>
    inventoryService.toggleSupplierActive(ctx.user.tenantId, input.id)),

  // ── Materiais
  createMaterial:  licensedProcedure.input(createMaterialSchema).mutation(({ ctx, input }) =>
    inventoryService.createMaterial(ctx.user.tenantId, input, ctx.user.userId)),
  listMaterials:   tenantProcedure.input(listMaterialsSchema).query(({ ctx, input }) =>
    inventoryService.listMaterials(ctx.user.tenantId, input)),
  getMaterial:     tenantProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) =>
    inventoryService.getMaterial(ctx.user.tenantId, input.id)),
  updateMaterial:  tenantProcedure.input(z.object({ id: z.number() }).merge(updateMaterialSchema)).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return inventoryService.updateMaterial(ctx.user.tenantId, id, data);
  }),
  toggleMaterial:  adminProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) =>
    inventoryService.toggleMaterialActive(ctx.user.tenantId, input.id)),

  // ── Movimentações
  createMovement:  tenantProcedure.input(createMovementSchema).mutation(({ ctx, input }) =>
    inventoryService.createMovement(ctx.user.tenantId, input, ctx.user.userId)),
  listMovements:   tenantProcedure.input(listMovementsSchema).query(({ ctx, input }) =>
    inventoryService.listMovements(ctx.user.tenantId, input)),
  consumeForJob:   tenantProcedure.input(z.object({
    materialId: z.number(),
    quantity: z.number().positive(),
    jobId: z.number(),
  })).mutation(({ ctx, input }) =>
    inventoryService.consumeForJob(ctx.user.tenantId, input.materialId, input.quantity, input.jobId, ctx.user.userId)),
  getDashboard:    tenantProcedure.query(({ ctx }) =>
    inventoryService.getDashboard(ctx.user.tenantId)),

  // ── Ordens de Compra
  createPO:       licensedProcedure.input(createPurchaseOrderSchema).mutation(({ ctx, input }) =>
    inventoryService.createPurchaseOrder(ctx.user.tenantId, input, ctx.user.userId)),
  listPOs:        tenantProcedure.input(listPurchaseOrdersSchema).query(({ ctx, input }) =>
    inventoryService.listPurchaseOrders(ctx.user.tenantId, input)),
  getPO:          tenantProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) =>
    inventoryService.getPurchaseOrder(ctx.user.tenantId, input.id)),
  updatePO:       tenantProcedure.input(z.object({ id: z.number() }).merge(updatePurchaseOrderSchema)).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return inventoryService.updatePurchaseOrder(ctx.user.tenantId, id, data);
  }),
  changePOStatus: adminProcedure.input(changePurchaseOrderStatusSchema).mutation(({ ctx, input }) =>
    inventoryService.changePurchaseOrderStatus(ctx.user.tenantId, input, ctx.user.userId)),
  importNfeXml:   adminProcedure.input(z.object({ xmlContent: z.string() })).mutation(({ ctx, input }) =>
    inventoryService.importNfeXml(ctx.user.tenantId, input.xmlContent, ctx.user.userId)),
});
