import { beforeAll, describe, expect, it } from 'vitest';

type PreferencesService = typeof import('./preferences.service.js');

let service: PreferencesService;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://user:pass@localhost:5432/proteticflow_test';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-with-at-least-32-chars';
  process.env.SETTINGS_SECRET_KEY = process.env.SETTINGS_SECRET_KEY ?? 'test-settings-secret-with-32-chars';

  service = await import('./preferences.service.js');
});

describe('proactive quiet hours timezone', () => {
  const preferences = {
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  };

  it('usa America/Sao_Paulo em vez de UTC para detectar quiet hours', () => {
    const nineteenBrt = new Date('2026-05-20T22:00:00.000Z');

    expect(service.isWithinQuietHours(preferences, nineteenBrt)).toBe(false);
  });

  it('cobre janela que cruza meia-noite em BRT', () => {
    const twentyTwoThirtyBrt = new Date('2026-05-21T01:30:00.000Z');
    const sevenBrt = new Date('2026-05-21T10:00:00.000Z');

    expect(service.isWithinQuietHours(preferences, twentyTwoThirtyBrt)).toBe(true);
    expect(service.isWithinQuietHours(preferences, sevenBrt)).toBe(false);
  });

  it('calcula release no fim da janela silenciosa em BRT', () => {
    const twentyThreeThirtyBrt = new Date('2026-05-21T02:30:45.000Z');

    expect(service.getQuietHoursReleaseAt(preferences, twentyThreeThirtyBrt).toISOString())
      .toBe('2026-05-21T10:00:00.000Z');
  });

  it('respeita America/Sao_Paulo em data historica com horario de verao', () => {
    const twentyTwoThirtySaoPauloDst = new Date('2018-12-01T00:30:00.000Z');

    expect(service.isWithinQuietHours(preferences, twentyTwoThirtySaoPauloDst)).toBe(true);
    expect(service.getQuietHoursReleaseAt(preferences, twentyTwoThirtySaoPauloDst).toISOString())
      .toBe('2018-12-01T09:00:00.000Z');
  });
});
