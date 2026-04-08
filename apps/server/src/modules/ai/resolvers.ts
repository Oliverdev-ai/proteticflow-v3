import { db } from '../../db/index.js';
import { clients, priceItems, pricingTables } from '../../db/schema/clients.js';
import { eq, ilike, and, isNull } from 'drizzle-orm';
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

type ResolvedClient = {
  id: number;
  name: string;
  pricingTableId: number | null;
};

type AmbiguousClientCandidate = {
  id: number;
  name: string;
  clinic: string | null;
  phone: string | null;
};

export type ResolveClientByNameResult =
  | { status: 'resolved'; client: ResolvedClient }
  | { status: 'ambiguous'; candidates: AmbiguousClientCandidate[] }
  | { status: 'not_found' };

export async function resolveClientByName(
  tenantId: number,
  name: string,
): Promise<ResolveClientByNameResult> {
  const normalizedName = name.trim().toLowerCase();

  const matches = await db.select({
    id: clients.id,
    name: clients.name,
    pricingTableId: clients.pricingTableId,
    clinic: clients.clinic,
    phone: clients.phone,
  }).from(clients)
    .where(and(
      eq(clients.tenantId, tenantId),
      isNull(clients.deletedAt),
      ilike(clients.name, `%${name}%`),
    ))
    .limit(5);

  if (matches.length === 0) {
    return { status: 'not_found' };
  }

  const exactMatches = matches.filter(
    (match) => match.name.trim().toLowerCase() === normalizedName,
  );

  if (exactMatches.length === 1) {
    const exact = exactMatches[0]!;
    return {
      status: 'resolved',
      client: {
        id: exact.id,
        name: exact.name,
        pricingTableId: exact.pricingTableId,
      },
    };
  }

  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      candidates: matches.map((match) => ({
        id: match.id,
        name: match.name,
        clinic: match.clinic,
        phone: match.phone,
      })),
    };
  }

  const [single] = matches;
  return {
    status: 'resolved',
    client: {
      id: single!.id,
      name: single!.name,
      pricingTableId: single!.pricingTableId,
    },
  };
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

