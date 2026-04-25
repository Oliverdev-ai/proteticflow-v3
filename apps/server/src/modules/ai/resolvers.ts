import { db } from '../../db/index.js';
import { clients, priceItems, pricingTables } from '../../db/schema/clients.js';
import { materials } from '../../db/schema/materials.js';
import { deliverySchedules } from '../../db/schema/deliveries.js';
import { eq, ilike, and, isNull, sql } from 'drizzle-orm';
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

type ResolvedMaterial = {
  id: number;
  name: string;
  unit: string;
  code: string | null;
  currentStock: string;
  minStock: string;
};

type MaterialCandidate = {
  id: number;
  name: string;
  unit: string;
  code: string | null;
};

export type ResolveMaterialResult =
  | { status: 'resolved'; material: ResolvedMaterial }
  | { status: 'ambiguous'; candidates: MaterialCandidate[] }
  | { status: 'not_found'; searchTerm: string; suggestions: string[] };

export async function resolveMaterial(
  tenantId: number,
  name: string,
): Promise<ResolveMaterialResult> {
  const searchTerm = name.trim();
  if (searchTerm.length < 2) {
    return { status: 'not_found', searchTerm, suggestions: [] };
  }

  const matches = await db
    .select({
      id: materials.id,
      name: materials.name,
      unit: materials.unit,
      code: materials.code,
      currentStock: materials.currentStock,
      minStock: materials.minStock,
    })
    .from(materials)
    .where(and(
      eq(materials.tenantId, tenantId),
      isNull(materials.deletedAt),
      ilike(materials.name, `%${searchTerm}%`),
    ))
    .limit(8);

  if (matches.length === 0) {
    const token = searchTerm.split(/\s+/)[0]?.trim();
    const suggestions = token
      ? await db
        .select({ name: materials.name })
        .from(materials)
        .where(and(
          eq(materials.tenantId, tenantId),
          isNull(materials.deletedAt),
          ilike(materials.name, `%${token}%`),
        ))
        .limit(5)
      : [];

    return {
      status: 'not_found',
      searchTerm,
      suggestions: suggestions.map((row) => row.name),
    };
  }

  const normalized = searchTerm.toLowerCase();
  const exactMatches = matches.filter((row) => row.name.trim().toLowerCase() === normalized);

  if (exactMatches.length === 1) {
    return { status: 'resolved', material: exactMatches[0]! };
  }

  if (matches.length === 1) {
    return { status: 'resolved', material: matches[0]! };
  }

  return {
    status: 'ambiguous',
    candidates: matches.map((row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      code: row.code,
    })),
  };
}

export type ResolveDeliveryPersonResult =
  | { status: 'resolved'; driverName: string | null }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'not_found'; searchTerm: string };

export async function resolveDeliveryPerson(
  tenantId: number,
  name?: string | null,
): Promise<ResolveDeliveryPersonResult> {
  const searchTerm = name?.trim();
  if (!searchTerm) {
    return { status: 'resolved', driverName: null };
  }

  const rows = await db
    .select({ driverName: deliverySchedules.driverName })
    .from(deliverySchedules)
    .where(and(
      eq(deliverySchedules.tenantId, tenantId),
      sql`${deliverySchedules.driverName} is not null`,
      ilike(deliverySchedules.driverName, `%${searchTerm}%`),
    ))
    .groupBy(deliverySchedules.driverName)
    .limit(6);

  const names = rows
    .map((row) => row.driverName?.trim() ?? '')
    .filter((value) => value.length > 0);

  if (names.length === 0) {
    return { status: 'not_found', searchTerm };
  }

  const exact = names.filter((value) => value.toLowerCase() === searchTerm.toLowerCase());
  if (exact.length === 1) {
    return { status: 'resolved', driverName: exact[0]! };
  }

  if (names.length === 1) {
    return { status: 'resolved', driverName: names[0]! };
  }

  return { status: 'ambiguous', candidates: names };
}

export type ResolvedPeriod = {
  label: string;
  startDate: string;
  endDate: string;
};

type ResolvePeriodInput =
  | string
  | {
    period?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    quarter?: string | null;
    year?: number | null;
  };

function atStartOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function atEndOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function quarterRange(year: number, quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4') {
  const quarterIndex = Number(quarter[1]) - 1;
  const startMonth = quarterIndex * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end };
}

function toResolvedPeriod(label: string, start: Date, end: Date): ResolvedPeriod {
  return {
    label,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

function previousQuarter(base: Date): { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; year: number } {
  const quarter = Math.floor(base.getMonth() / 3) + 1;
  if (quarter === 1) return { quarter: 'Q4', year: base.getFullYear() - 1 };
  return { quarter: `Q${quarter - 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4', year: base.getFullYear() };
}

export function resolvePeriod(input?: ResolvePeriodInput): ResolvedPeriod {
  const now = new Date();

  if (!input) {
    const start = atStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = atEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return toResolvedPeriod('mes_atual', start, end);
  }

  if (typeof input === 'object') {
    if (input.startDate && input.endDate) {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Periodo custom invalido' });
      }
      return toResolvedPeriod('custom', atStartOfDay(start), atEndOfDay(end));
    }

    if (input.quarter) {
      const quarter = input.quarter.toUpperCase() as 'Q1' | 'Q2' | 'Q3' | 'Q4';
      const year = input.year ?? now.getFullYear();
      const range = quarterRange(year, quarter);
      return toResolvedPeriod(`${quarter}-${year}`, range.start, range.end);
    }
  }

  const rawPeriod = typeof input === 'string'
    ? input
    : input.period ?? '';
  const normalized = rawPeriod
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

  if (!normalized || normalized === 'mes' || normalized === 'mes atual') {
    const start = atStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = atEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return toResolvedPeriod('mes_atual', start, end);
  }

  if (normalized.includes('hoje') || normalized === 'today') {
    const start = atStartOfDay(now);
    const end = atEndOfDay(now);
    return toResolvedPeriod('hoje', start, end);
  }

  if (normalized.includes('semana') || normalized === 'week') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = atStartOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday));
    const end = atEndOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    return toResolvedPeriod('semana_atual', start, end);
  }

  if (normalized.includes('ano') || normalized === 'year') {
    const start = atStartOfDay(new Date(now.getFullYear(), 0, 1));
    const end = atEndOfDay(new Date(now.getFullYear(), 11, 31));
    return toResolvedPeriod('ano_atual', start, end);
  }

  if (normalized.includes('trimestre passado')) {
    const last = previousQuarter(now);
    const range = quarterRange(last.year, last.quarter);
    return toResolvedPeriod(`${last.quarter}-${last.year}`, range.start, range.end);
  }

  if (normalized.includes('trimestre') || normalized === 'quarter') {
    const currentQuarter = `Q${Math.floor(now.getMonth() / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4';
    const range = quarterRange(now.getFullYear(), currentQuarter);
    return toResolvedPeriod(`${currentQuarter}-${now.getFullYear()}`, range.start, range.end);
  }

  const quarterMatch = normalized.match(/\bq([1-4])\b(?:[^\d]*(20\d{2}))?/);
  if (quarterMatch?.[1]) {
    const quarter = `Q${quarterMatch[1]}` as 'Q1' | 'Q2' | 'Q3' | 'Q4';
    const year = quarterMatch[2] ? Number(quarterMatch[2]) : now.getFullYear();
    const range = quarterRange(year, quarter);
    return toResolvedPeriod(`${quarter}-${year}`, range.start, range.end);
  }

  const monthMatch = normalized.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (monthMatch?.[1] && monthMatch[2]) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    const start = atStartOfDay(new Date(year, month - 1, 1));
    const end = atEndOfDay(new Date(year, month, 0));
    return toResolvedPeriod(`mes_${monthMatch[1]}-${monthMatch[2]}`, start, end);
  }

  throw new TRPCError({ code: 'BAD_REQUEST', message: `Periodo nao reconhecido: ${rawPeriod}` });
}

