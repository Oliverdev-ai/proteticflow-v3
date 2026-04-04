import { db } from '../../db/index.js';
import { clients, priceItems, pricingTables } from '../../db/schema/clients.js';
import { eq, ilike, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export function parseNaturalDate(input?: string): Date {
  const d = new Date();
  if (!input) {
    d.setDate(d.getDate() + 7);
    return d;
  }
  const low = input.toLowerCase();
  if (low.includes('sexta')) {
    d.setDate(d.getDate() + ((5 + 7 - d.getDay()) % 7 || 7));
  } else if (low.includes('segunda')) {
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
  } else {
    const iso = new Date(input);
    if (!isNaN(iso.getTime())) return iso;
    d.setDate(d.getDate() + 7);
  }
  return d;
}

export async function resolveClientByName(tenantId: number, name: string) {
  const results = await db.select().from(clients)
    .where(and(eq(clients.tenantId, tenantId), ilike(clients.name, `%${name}%`)))
    .limit(1);
  return results[0];
}

type ServiceItemInput = {
  serviceName: string;
  quantity?: number;
  color?: string;
};

type ResolvedItem = {
  priceItemId: number;
  serviceName: string;
  quantity: number;
  unitPriceCents: number;
  adjustmentPercent: number;
};

export async function resolveServiceItems(
  tenantId: number,
  priceTableId: number | null,
  items: ServiceItemInput[],
): Promise<ResolvedItem[]> {
  if (!items.length) return [];

  const resolved: ResolvedItem[] = [];

  for (const item of items) {
    const conditions = [
      eq(pricingTables.tenantId, tenantId),
      ilike(priceItems.name, `%${item.serviceName}%`),
    ];

    if (priceTableId !== null) {
      conditions.push(eq(priceItems.pricingTableId, priceTableId));
    }

    const [found] = await db.select()
      .from(priceItems)
      .innerJoin(pricingTables, eq(priceItems.pricingTableId, pricingTables.id))
      .where(and(...conditions))
      .limit(1);

    if (!found) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Serviço "${item.serviceName}" não encontrado na tabela de preços`,
      });
    }

    resolved.push({
      priceItemId: found.price_items.id,
      serviceName: found.price_items.name,
      quantity: item.quantity ?? 1,
      unitPriceCents: found.price_items.priceCents,
      adjustmentPercent: 0,
    });
  }

  return resolved;
}

