import { z } from 'zod';
import { router, tenantProcedure, adminProcedure, licensedProcedure } from '../../trpc/trpc.js';
import {
  createPricingTableSchema,
  updatePricingTableSchema,
  createPriceItemSchema,
  updatePriceItemSchema,
  bulkAdjustSchema,
  listPriceItemsSchema,
  listPricingTablesSchema,
} from '@proteticflow/shared';
import * as pricingService from './service.js';

export const pricingRouter = router({
  // ── Tables ─────────────────────────────────────────────────────────────────
  createTable: licensedProcedure
    .input(createPricingTableSchema)
    .mutation(async ({ input, ctx }) => {
      return pricingService.createTable(ctx.tenantId!, input);
    }),

  listTables: tenantProcedure
    .input(listPricingTablesSchema)
    .query(async ({ input, ctx }) => {
      return pricingService.listTables(ctx.tenantId!, input);
    }),

  getTable: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return pricingService.getTable(ctx.tenantId!, input.id);
    }),

  updateTable: adminProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(updatePricingTableSchema))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return pricingService.updateTable(ctx.tenantId!, id, data);
    }),

  deleteTable: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await pricingService.deleteTable(ctx.tenantId!, input.id);
      return { success: true };
    }),

  // ── Items ──────────────────────────────────────────────────────────────────
  createItem: licensedProcedure
    .input(createPriceItemSchema)
    .mutation(async ({ input, ctx }) => {
      return pricingService.createItem(ctx.tenantId!, input);
    }),

  listItems: tenantProcedure
    .input(listPriceItemsSchema)
    .query(async ({ input, ctx }) => {
      return pricingService.listItems(ctx.tenantId!, input);
    }),

  updateItem: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(updatePriceItemSchema))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return pricingService.updateItem(ctx.tenantId!, id, data);
    }),

  deleteItem: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await pricingService.deleteItem(ctx.tenantId!, input.id);
      return { success: true };
    }),

  // ── Bulk operations ────────────────────────────────────────────────────────
  bulkAdjust: adminProcedure
    .input(bulkAdjustSchema)
    .mutation(async ({ input, ctx }) => {
      return pricingService.bulkAdjust(ctx.tenantId!, input);
    }),

  exportCsv: tenantProcedure
    .input(z.object({ tableId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return pricingService.exportCsv(ctx.tenantId!, input.tableId);
    }),

  importCsv: adminProcedure
    .input(z.object({ tableId: z.number().int().positive(), csvContent: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return pricingService.importCsv(ctx.tenantId!, input.tableId, input.csvContent);
    }),
});
