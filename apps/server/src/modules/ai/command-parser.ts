import { and, eq, ilike, isNull } from 'drizzle-orm';
import type { Role } from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { clients, priceItems } from '../../db/schema/clients.js';
import { materials, suppliers } from '../../db/schema/materials.js';
import { tenantMembers } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';

export type RiskLevel = 'read_only' | 'assistive' | 'transactional' | 'critical';
export type ParsedEntityValue = string | number | boolean;
export type ParsedEntities = Record<string, ParsedEntityValue>;

type FlowCommandConfig = {
  risk: RiskLevel;
  roles: Role[];
  patterns: RegExp[];
  requiredFields?: string[];
};

export const FLOW_COMMANDS = {
  'jobs.listPending': {
    risk: 'read_only',
    roles: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
    patterns: [/trabalhos? pendentes?/i, /os pendentes?/i, /pendencias? de os/i],
  },
  'jobs.getById': {
    risk: 'read_only',
    roles: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
    patterns: [/detalhe.*os/i, /(buscar|abrir).*(os|trabalho)/i, /status da os/i],
    requiredFields: ['jobId'],
  },
  'deliveries.listToday': {
    risk: 'read_only',
    roles: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
    patterns: [/entregas?.*(hoje|dia)/i, /roteiro de entrega/i],
  },
  'clients.search': {
    risk: 'read_only',
    roles: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
    patterns: [/buscar cliente/i, /encontrar (dr|cliente|dentista)/i, /procurar cliente/i],
    requiredFields: ['clientName'],
  },
  'clients.list': {
    risk: 'read_only',
    roles: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
    patterns: [/listar clientes/i, /lista de clientes/i, /clientes ativos/i],
  },
  'analytics.monthSummary': {
    risk: 'read_only',
    roles: ['superadmin', 'gerente', 'contabil'],
    patterns: [/resumo do mes/i, /kpis? do mes/i, /painel do mes/i],
  },
  'reports.abcCurve': {
    risk: 'read_only',
    roles: ['superadmin', 'gerente', 'contabil'],
    patterns: [/curva abc/i, /pareto/i],
  },
  'reports.accountsReceivable': {
    risk: 'read_only',
    roles: ['superadmin', 'gerente', 'contabil'],
    patterns: [/contas? a receber/i, /ar em aberto/i, /inadimplencia/i],
  },
  'ai.productionEstimate': {
    risk: 'assistive',
    roles: ['superadmin', 'gerente', 'producao'],
    patterns: [/estimar producao/i, /estimativa de prazo/i, /tempo de producao/i],
  },
  'analytics.revenueForecast': {
    risk: 'assistive',
    roles: ['superadmin', 'gerente', 'contabil'],
    patterns: [/previs(a|a)o de receita/i, /forecast de receita/i, /projecao de faturamento/i],
  },
  'jobs.createDraft': {
    risk: 'transactional',
    roles: ['superadmin', 'gerente', 'recepcao'],
    patterns: [/criar (nova )?os/i, /cadastrar trabalho/i, /abrir ordem/i],
    requiredFields: ['clientName', 'deadline', 'serviceName'],
  },
  'jobs.finalize': {
    risk: 'transactional',
    roles: ['superadmin', 'gerente', 'producao'],
    patterns: [/finalizar trabalho/i, /concluir os/i, /marcar como entregue/i],
    requiredFields: ['jobId'],
  },
  'jobs.suspend': {
    risk: 'transactional',
    roles: ['superadmin', 'gerente'],
    patterns: [/suspender os/i, /pausar os/i],
    requiredFields: ['jobId', 'reason'],
  },
  'jobs.toggleUrgent': {
    risk: 'transactional',
    roles: ['superadmin', 'gerente'],
    patterns: [/(marcar|desmarcar|tirar).*urgente/i, /os urgente/i],
    requiredFields: ['jobId', 'isUrgent'],
  },
  'jobs.createRework': {
    risk: 'transactional',
    roles: ['superadmin', 'gerente'],
    patterns: [/remoldagem/i, /rework/i],
    requiredFields: ['jobId', 'reason'],
  },
  'agenda.createEvent': {
    risk: 'transactional',
    roles: ['superadmin', 'gerente', 'recepcao', 'producao'],
    patterns: [/agendar/i, /criar evento/i, /marcar (prova|reuniao|entrega)/i],
    requiredFields: ['title', 'startAt', 'endAt'],
  },
  'clients.createDraft': {
    risk: 'transactional',
    roles: ['superadmin', 'gerente', 'recepcao'],
    patterns: [/cadastrar cliente/i, /novo cliente/i],
    requiredFields: ['name'],
  },
  'purchases.create': {
    risk: 'transactional',
    roles: ['superadmin', 'gerente'],
    patterns: [/criar compra/i, /nova compra/i, /gerar pedido de compra/i],
    requiredFields: ['supplierName', 'materialName', 'quantity', 'unitPriceCents'],
  },
  'financial.closeAccount': {
    risk: 'critical',
    roles: ['superadmin', 'gerente', 'contabil'],
    patterns: [/baixar conta/i, /fechar conta/i, /dar baixa/i],
  },
  'financial.monthlyClosing': {
    risk: 'critical',
    roles: ['superadmin', 'gerente', 'contabil'],
    patterns: [/fechamento mensal/i, /fechar mes/i],
  },
  'payroll.generate': {
    risk: 'critical',
    roles: ['superadmin', 'gerente', 'contabil'],
    patterns: [/gerar folha/i, /processar folha/i],
  },
  'purchases.receive': {
    risk: 'critical',
    roles: ['superadmin', 'gerente'],
    patterns: [/receber compra/i, /dar entrada na compra/i],
  },
} as const satisfies Record<string, FlowCommandConfig>;

export type FlowCommandName = keyof typeof FLOW_COMMANDS;

export type ParsedIntent = {
  intent: FlowCommandName | null;
  confidence: number;
  entities: ParsedEntities;
  missingFields: string[];
  suggestedIntents: FlowCommandName[];
  normalizedInput: string;
};

export type ResolvedEntity =
  | { status: 'resolved'; id: number; label: string }
  | { status: 'ambiguous'; candidates: Array<{ id: number; label: string; detail?: string }> }
  | { status: 'not_found'; searchTerm: string };

export type ResolvedEntities = Record<string, ResolvedEntity>;

function normalizeInput(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEntityInt(match: RegExpMatchArray | null, groupIndex: number): number | undefined {
  const value = match?.[groupIndex];
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseEntityDecimal(match: RegExpMatchArray | null, groupIndex: number): number | undefined {
  const value = match?.[groupIndex]?.replace(/\./g, '').replace(',', '.');
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNaturalPeriod(rawInput: string): string | undefined {
  const monthYear = rawInput.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])\b/);
  if (monthYear?.[1] && monthYear?.[2]) {
    return `${monthYear[1]}-${monthYear[2]}`;
  }
  return undefined;
}

function parseEntities(rawInput: string, normalizedInput: string): ParsedEntities {
  const entities: ParsedEntities = {};

  const osMatch = normalizedInput.match(/\b(?:os|trabalho|ordem)\s*#?\s*(\d{1,8})\b/);
  const jobId = parseEntityInt(osMatch, 1);
  if (jobId !== undefined) {
    entities.jobId = jobId;
  }

  const purchaseMatch = normalizedInput.match(/\b(?:cmp[-\s]?|compra\s*#?)\s*(\d{1,8})\b/);
  const purchaseId = parseEntityInt(purchaseMatch, 1);
  if (purchaseId !== undefined) {
    entities.purchaseId = purchaseId;
  }

  const arMatch = normalizedInput.match(/\b(?:ar|conta)\s*#?\s*(\d{1,8})\b/);
  const arId = parseEntityInt(arMatch, 1);
  if (arId !== undefined) {
    entities.arId = arId;
  }

  const period = parseNaturalPeriod(normalizedInput);
  if (period) {
    entities.period = period;
  }

  const periodIdMatch = normalizedInput.match(/\bperiodo\s*#?\s*(\d{1,8})\b/);
  const periodId = parseEntityInt(periodIdMatch, 1);
  if (periodId !== undefined) {
    entities.periodId = periodId;
  }

  const quantityMatch = normalizedInput.match(/\b(\d+(?:[.,]\d+)?)\s*(?:un|unid|itens?)\b/);
  const quantity = parseEntityDecimal(quantityMatch, 1);
  if (quantity !== undefined) {
    entities.quantity = quantity;
  }

  const unitPriceMatch = normalizedInput.match(/(?:r\$|valor|preco)\s*(\d+(?:[.,]\d+)?)/i);
  const unitPrice = parseEntityDecimal(unitPriceMatch, 1);
  if (unitPrice !== undefined) {
    entities.unitPriceCents = Math.round(unitPrice * 100);
  }

  const clientNameMatch = rawInput.match(/(?:dr\.?|dra\.?|cliente|dentista)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s'-]{2,80})/i);
  if (clientNameMatch?.[1]) {
    entities.clientName = clientNameMatch[1].trim();
  }

  const supplierNameMatch = rawInput.match(/fornecedor\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s'-]{2,80})/i);
  if (supplierNameMatch?.[1]) {
    entities.supplierName = supplierNameMatch[1].trim();
  }

  const materialNameMatch = rawInput.match(/material\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s'-]{2,80})/i);
  if (materialNameMatch?.[1]) {
    entities.materialName = materialNameMatch[1].trim();
  }

  const serviceNameMatch = rawInput.match(/(?:servico|serviço|tipo)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s'-]{2,80})/i);
  if (serviceNameMatch?.[1]) {
    entities.serviceName = serviceNameMatch[1].trim();
  }

  const reasonMatch = rawInput.match(/(?:motivo|porque|por)\s+(.+)/i);
  if (reasonMatch?.[1]) {
    entities.reason = reasonMatch[1].trim();
  }

  if (normalizedInput.includes('desmarcar urgente') || normalizedInput.includes('tirar urgente')) {
    entities.isUrgent = false;
  } else if (normalizedInput.includes('urgente')) {
    entities.isUrgent = true;
  }

  const deadlineIso = normalizedInput.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (deadlineIso?.[1]) {
    entities.deadline = `${deadlineIso[1]}T12:00:00.000Z`;
    entities.startAt = `${deadlineIso[1]}T12:00:00.000Z`;
    entities.endAt = `${deadlineIso[1]}T12:30:00.000Z`;
  }

  if (normalizedInput.includes('hoje')) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(12, 0, 0, 0);
    const end = new Date(now);
    end.setHours(12, 30, 0, 0);
    entities.deadline = start.toISOString();
    entities.startAt = start.toISOString();
    entities.endAt = end.toISOString();
  }

  if (normalizedInput.includes('amanha') || normalizedInput.includes('amanhã')) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const start = new Date(tomorrow);
    start.setHours(12, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(12, 30, 0, 0);
    entities.deadline = start.toISOString();
    entities.startAt = start.toISOString();
    entities.endAt = end.toISOString();
  }

  if (normalizedInput.startsWith('agendar') || normalizedInput.includes('criar evento')) {
    entities.title = rawInput.trim();
  }

  if (normalizedInput.startsWith('cadastrar cliente') || normalizedInput.startsWith('novo cliente')) {
    const name = rawInput
      .replace(/cadastrar cliente/i, '')
      .replace(/novo cliente/i, '')
      .trim();
    if (name.length >= 3) {
      entities.name = name;
    }
  }

  return entities;
}

function scoreIntent(normalizedInput: string, command: FlowCommandName): number {
  const config = FLOW_COMMANDS[command];
  return config.patterns.reduce((score, pattern) => (pattern.test(normalizedInput) ? score + 1 : score), 0);
}

function suggestIntents(normalizedInput: string): Array<{ intent: FlowCommandName; score: number }> {
  const intents = (Object.keys(FLOW_COMMANDS) as FlowCommandName[])
    .map((intent) => ({ intent, score: scoreIntent(normalizedInput, intent) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return intents;
}

function toCandidate(id: number, label: string, detail: string | null | undefined) {
  return detail ? { id, label, detail } : { id, label };
}

function calculateConfidence(topScore: number, secondScore: number): number {
  const base = 0.58 + topScore * 0.14;
  const separationPenalty = secondScore >= topScore ? 0.22 : secondScore > 0 && secondScore === topScore - 1 ? 0.08 : 0;
  const confidence = Math.max(0.15, Math.min(0.99, base - separationPenalty));
  return Number(confidence.toFixed(3));
}

export async function parseIntent(rawInput: string, _tenantId: number): Promise<ParsedIntent> {
  const normalizedInput = normalizeInput(rawInput);
  if (!normalizedInput) {
    return {
      intent: null,
      confidence: 0,
      entities: {},
      missingFields: [],
      suggestedIntents: [],
      normalizedInput,
    };
  }

  const ranked = suggestIntents(normalizedInput);
  const top = ranked[0];
  const second = ranked[1];

  if (!top) {
    return {
      intent: null,
      confidence: 0.2,
      entities: parseEntities(rawInput, normalizedInput),
      missingFields: [],
      suggestedIntents: [],
      normalizedInput,
    };
  }

  const confidence = calculateConfidence(top.score, second?.score ?? 0);
  const entities = parseEntities(rawInput, normalizedInput);
  const topConfig = FLOW_COMMANDS[top.intent] as FlowCommandConfig;
  const requiredFields = topConfig.requiredFields ?? [];
  const missingFields = requiredFields.filter((field: string) => {
    const value = entities[field];
    if (typeof value === 'boolean') return false;
    if (typeof value === 'number') return !Number.isFinite(value);
    if (typeof value === 'string') return value.trim().length === 0;
    return true;
  });

  if (confidence < 0.7) {
    return {
      intent: null,
      confidence,
      entities,
      missingFields: [],
      suggestedIntents: ranked.slice(0, 3).map((entry) => entry.intent),
      normalizedInput,
    };
  }

  return {
    intent: top.intent,
    confidence,
    entities,
    missingFields,
    suggestedIntents: ranked.slice(1, 4).map((entry) => entry.intent),
    normalizedInput,
  };
}

async function resolveClientsByName(tenantId: number, searchTerm: string): Promise<ResolvedEntity> {
  const rows = await db
    .select({
      id: clients.id,
      label: clients.name,
      detail: clients.clinic,
    })
    .from(clients)
    .where(
      and(
        eq(clients.tenantId, tenantId),
        isNull(clients.deletedAt),
        ilike(clients.name, `%${searchTerm}%`),
      ),
    )
    .limit(5);

  if (rows.length === 0) return { status: 'not_found', searchTerm };
  if (rows.length === 1) return { status: 'resolved', id: rows[0]!.id, label: rows[0]!.label };
  return {
    status: 'ambiguous',
    candidates: rows.map((row) => toCandidate(row.id, row.label, row.detail)),
  };
}

async function resolveSuppliersByName(tenantId: number, searchTerm: string): Promise<ResolvedEntity> {
  const rows = await db
    .select({
      id: suppliers.id,
      label: suppliers.name,
      detail: suppliers.cnpj,
    })
    .from(suppliers)
    .where(
      and(
        eq(suppliers.tenantId, tenantId),
        isNull(suppliers.deletedAt),
        ilike(suppliers.name, `%${searchTerm}%`),
      ),
    )
    .limit(5);

  if (rows.length === 0) return { status: 'not_found', searchTerm };
  if (rows.length === 1) return { status: 'resolved', id: rows[0]!.id, label: rows[0]!.label };
  return {
    status: 'ambiguous',
    candidates: rows.map((row) => toCandidate(row.id, row.label, row.detail)),
  };
}

async function resolveMaterialsByName(tenantId: number, searchTerm: string): Promise<ResolvedEntity> {
  const rows = await db
    .select({
      id: materials.id,
      label: materials.name,
      detail: materials.code,
    })
    .from(materials)
    .where(
      and(
        eq(materials.tenantId, tenantId),
        isNull(materials.deletedAt),
        ilike(materials.name, `%${searchTerm}%`),
      ),
    )
    .limit(5);

  if (rows.length === 0) return { status: 'not_found', searchTerm };
  if (rows.length === 1) return { status: 'resolved', id: rows[0]!.id, label: rows[0]!.label };
  return {
    status: 'ambiguous',
    candidates: rows.map((row) => toCandidate(row.id, row.label, row.detail)),
  };
}

async function resolveUsersByName(tenantId: number, searchTerm: string): Promise<ResolvedEntity> {
  const rows = await db
    .select({
      id: users.id,
      label: users.name,
      detail: tenantMembers.role,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(users.id, tenantMembers.userId))
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.isActive, true),
        ilike(users.name, `%${searchTerm}%`),
      ),
    )
    .limit(5);

  if (rows.length === 0) return { status: 'not_found', searchTerm };
  if (rows.length === 1) return { status: 'resolved', id: rows[0]!.id, label: rows[0]!.label };
  return {
    status: 'ambiguous',
    candidates: rows.map((row) => toCandidate(row.id, row.label, row.detail)),
  };
}

async function resolveServiceByName(tenantId: number, searchTerm: string): Promise<ResolvedEntity> {
  const rows = await db
    .select({
      id: priceItems.id,
      label: priceItems.name,
      detail: priceItems.code,
    })
    .from(priceItems)
    .where(
      and(
        eq(priceItems.tenantId, tenantId),
        isNull(priceItems.deletedAt),
        ilike(priceItems.name, `%${searchTerm}%`),
      ),
    )
    .limit(5);

  if (rows.length === 0) return { status: 'not_found', searchTerm };
  if (rows.length === 1) return { status: 'resolved', id: rows[0]!.id, label: rows[0]!.label };
  return {
    status: 'ambiguous',
    candidates: rows.map((row) => toCandidate(row.id, row.label, row.detail)),
  };
}

export async function resolveEntities(entities: ParsedEntities, tenantId: number): Promise<ResolvedEntities> {
  const resolved: ResolvedEntities = {};

  for (const [key, value] of Object.entries(entities)) {
    if (typeof value === 'number' && key.endsWith('Id')) {
      resolved[key] = { status: 'resolved', id: value, label: `#${value}` };
      continue;
    }

    if (typeof value !== 'string') continue;
    if (value.trim().length < 2) continue;

    if (key === 'clientName') {
      resolved[key] = await resolveClientsByName(tenantId, value);
      continue;
    }
    if (key === 'supplierName') {
      resolved[key] = await resolveSuppliersByName(tenantId, value);
      continue;
    }
    if (key === 'materialName') {
      resolved[key] = await resolveMaterialsByName(tenantId, value);
      continue;
    }
    if (key === 'userName' || key === 'technicianName') {
      resolved[key] = await resolveUsersByName(tenantId, value);
      continue;
    }
    if (key === 'serviceName') {
      resolved[key] = await resolveServiceByName(tenantId, value);
      continue;
    }
  }

  return resolved;
}

export function checkCommandAccess(command: FlowCommandName, userRole: Role): boolean {
  return (FLOW_COMMANDS[command].roles as readonly Role[]).includes(userRole);
}

export function resolveAction(risk: RiskLevel): 'execute' | 'review' | 'confirm' {
  if (risk === 'read_only' || risk === 'assistive') return 'execute';
  if (risk === 'transactional') return 'review';
  return 'confirm';
}
