import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import type {
  MuteAlertsInput,
  ProactiveAlertType,
  UpdateUserPreferencesInput,
} from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { tenantMembers } from '../../db/schema/tenants.js';
import {
  type UserChannelsConfig,
  userPreferences as userPreferencesTable,
} from '../../db/schema/proactive.js';

const DEFAULT_CHANNELS: UserChannelsConfig = {
  push: true,
  email: true,
  whatsapp: false,
  in_app: true,
};

function parseTimeToMinutes(value: string): number {
  const [hourText = '0', minuteText = '0'] = value.split(':');
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return Math.max(0, Math.min(23, hour)) * 60 + Math.max(0, Math.min(59, minute));
}

function normalizeTime(value: string): string {
  const [hourText = '00', minuteText = '00'] = value.split(':');
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  const hh = String(Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 0).padStart(2, '0');
  const mm = String(Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeChannels(channels: UserChannelsConfig | null | undefined): UserChannelsConfig {
  const source = channels ?? DEFAULT_CHANNELS;
  return {
    push: source.push !== false,
    email: source.email !== false,
    whatsapp: source.whatsapp === true,
    in_app: source.in_app ?? source.inApp ?? true,
    ...(source.mutedUntilByType ? { mutedUntilByType: source.mutedUntilByType } : {}),
  };
}

function ensureAlertTypeArray(value: string[] | null | undefined): ProactiveAlertType[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<ProactiveAlertType>();
  for (const item of value) {
    if (
      item === 'briefing_daily'
      || item === 'deadline_24h'
      || item === 'deadline_overdue'
      || item === 'stock_low'
      || item === 'payment_overdue'
    ) {
      unique.add(item);
    }
  }
  return [...unique];
}

async function assertTenantMembership(tenantId: number, userId: number): Promise<void> {
  const [member] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.isActive, true),
    ))
    .limit(1);

  if (!member) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuario nao pertence ao tenant ativo' });
  }
}

async function ensurePreferencesRow(tenantId: number, userId: number) {
  await assertTenantMembership(tenantId, userId);

  const [existing] = await db
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(userPreferencesTable)
    .values({
      tenantId,
      userId,
      briefingEnabled: true,
      briefingTime: '08:00',
      quietHoursStart: '20:00',
      quietHoursEnd: '07:00',
      channels: DEFAULT_CHANNELS,
      alertTypesMuted: [],
    })
    .returning();

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao inicializar preferencias' });
  }

  return created;
}

export type ProactiveUserPreferences = {
  userId: number;
  tenantId: number;
  briefingEnabled: boolean;
  briefingTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  channels: UserChannelsConfig;
  alertTypesMuted: ProactiveAlertType[];
  updatedAt: string;
};

function toPreferencesModel(row: typeof userPreferencesTable.$inferSelect): ProactiveUserPreferences {
  return {
    userId: row.userId,
    tenantId: row.tenantId,
    briefingEnabled: row.briefingEnabled,
    briefingTime: normalizeTime(row.briefingTime),
    quietHoursStart: normalizeTime(row.quietHoursStart),
    quietHoursEnd: normalizeTime(row.quietHoursEnd),
    channels: normalizeChannels(row.channels),
    alertTypesMuted: ensureAlertTypeArray(row.alertTypesMuted),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getUserPreferences(
  tenantId: number,
  userId: number,
): Promise<ProactiveUserPreferences> {
  const row = await ensurePreferencesRow(tenantId, userId);
  return toPreferencesModel(row);
}

export async function updateUserPreferences(
  tenantId: number,
  userId: number,
  input: UpdateUserPreferencesInput,
): Promise<ProactiveUserPreferences> {
  const existing = await ensurePreferencesRow(tenantId, userId);
  const currentChannels = normalizeChannels(existing.channels);
  const patchChannels = input.channels ?? {};

  const nextChannels: UserChannelsConfig = {
    ...currentChannels,
    push: patchChannels.push ?? currentChannels.push,
    email: patchChannels.email ?? currentChannels.email,
    whatsapp: patchChannels.whatsapp ?? currentChannels.whatsapp,
    in_app: patchChannels.in_app ?? currentChannels.in_app,
    ...(patchChannels.mutedUntilByType !== undefined
      ? { mutedUntilByType: patchChannels.mutedUntilByType }
      : (currentChannels.mutedUntilByType ? { mutedUntilByType: currentChannels.mutedUntilByType } : {})),
  };

  const [updated] = await db
    .update(userPreferencesTable)
    .set({
      briefingEnabled: input.briefingEnabled ?? existing.briefingEnabled,
      briefingTime: input.briefingTime ?? normalizeTime(existing.briefingTime),
      quietHoursStart: input.quietHoursStart ?? normalizeTime(existing.quietHoursStart),
      quietHoursEnd: input.quietHoursEnd ?? normalizeTime(existing.quietHoursEnd),
      channels: nextChannels,
      alertTypesMuted: input.alertTypesMuted ?? ensureAlertTypeArray(existing.alertTypesMuted),
      updatedAt: new Date(),
    })
    .where(eq(userPreferencesTable.userId, userId))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar preferencias' });
  }

  return toPreferencesModel(updated);
}

export async function muteAlerts(
  tenantId: number,
  actorUserId: number,
  input: MuteAlertsInput,
): Promise<ProactiveUserPreferences> {
  const targetUserId = input.userId ?? actorUserId;
  const existing = await ensurePreferencesRow(tenantId, targetUserId);
  const currentChannels = normalizeChannels(existing.channels);

  const alertTypesMuted = new Set<ProactiveAlertType>(ensureAlertTypeArray(existing.alertTypesMuted));
  for (const alertType of input.alertTypes) {
    alertTypesMuted.add(alertType);
  }

  const mutedUntilByType = { ...(currentChannels.mutedUntilByType ?? {}) };
  if (input.until) {
    for (const alertType of input.alertTypes) {
      mutedUntilByType[alertType] = input.until;
    }
  }

  const nextChannels: UserChannelsConfig = {
    ...currentChannels,
    ...(Object.keys(mutedUntilByType).length > 0 ? { mutedUntilByType } : {}),
  };

  const [updated] = await db
    .update(userPreferencesTable)
    .set({
      channels: nextChannels,
      alertTypesMuted: [...alertTypesMuted],
      updatedAt: new Date(),
    })
    .where(eq(userPreferencesTable.userId, targetUserId))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao silenciar alertas' });
  }

  return toPreferencesModel(updated);
}

export function isAlertMuted(
  preferences: Pick<ProactiveUserPreferences, 'alertTypesMuted' | 'channels'>,
  alertType: ProactiveAlertType,
  now: Date = new Date(),
): boolean {
  if (preferences.alertTypesMuted.includes(alertType)) return true;
  const mutedUntil = preferences.channels.mutedUntilByType?.[alertType];
  if (!mutedUntil) return false;
  const untilDate = new Date(mutedUntil);
  return Number.isFinite(untilDate.getTime()) && untilDate.getTime() > now.getTime();
}

export function isWithinQuietHours(
  preferences: Pick<ProactiveUserPreferences, 'quietHoursStart' | 'quietHoursEnd'>,
  now: Date = new Date(),
): boolean {
  const start = parseTimeToMinutes(preferences.quietHoursStart);
  const end = parseTimeToMinutes(preferences.quietHoursEnd);
  if (start === end) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

export function getQuietHoursReleaseAt(
  preferences: Pick<ProactiveUserPreferences, 'quietHoursStart' | 'quietHoursEnd'>,
  now: Date = new Date(),
): Date {
  const end = normalizeTime(preferences.quietHoursEnd);
  const [endHourText = '0', endMinuteText = '0'] = end.split(':');
  const endHour = Number.parseInt(endHourText, 10);
  const endMinute = Number.parseInt(endMinuteText, 10);
  const releaseAt = new Date(now);
  releaseAt.setSeconds(0, 0);
  releaseAt.setHours(
    Number.isFinite(endHour) ? endHour : 0,
    Number.isFinite(endMinute) ? endMinute : 0,
    0,
    0,
  );

  if (releaseAt.getTime() <= now.getTime()) {
    releaseAt.setDate(releaseAt.getDate() + 1);
  }
  return releaseAt;
}
