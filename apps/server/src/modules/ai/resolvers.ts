import { db } from '../../db/index.js';
import { clients, jobs, serviceItems, jobItems } from '../../db/schema.js';
import { eq, ilike, and } from 'drizzle-orm';

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

export async function resolveServiceItems(tenantId: number, priceTableId: number | null, items: any[]) {
  // Mock resolver logic for the tool
  return items.map(item => ({
    serviceName: item.serviceName,
    quantity: item.quantity ?? 1,
    color: item.color,
  }));
}
