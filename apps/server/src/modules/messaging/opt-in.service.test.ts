import { describe, expect, it } from 'vitest';
import { normalizePhoneE164 } from './opt-in.service.js';

describe('normalizePhoneE164', () => {
  it('normaliza telefone brasileiro local com DDI 55', () => {
    expect(normalizePhoneE164('(11) 99999-0000')).toBe('5511999990000');
    expect(normalizePhoneE164('1133334444')).toBe('551133334444');
  });

  it('preserva telefone brasileiro ja informado com DDI 55', () => {
    expect(normalizePhoneE164('55 11 99999-0000')).toBe('5511999990000');
  });

  it('aceita telefone internacional somente quando vem com sinal de mais', () => {
    expect(normalizePhoneE164('+1 (415) 555-2671')).toBe('14155552671');
    expect(normalizePhoneE164('331234567890')).toBeNull();
  });

  it('rejeita comprimentos ambiguos sem DDI explicito', () => {
    expect(normalizePhoneE164('999999999')).toBeNull();
    expect(normalizePhoneE164('33119999990000')).toBeNull();
    expect(normalizePhoneE164('abc')).toBeNull();
  });

  it('rejeita telefone brasileiro local com DDD invalido', () => {
    expect(normalizePhoneE164('2012345678')).toBeNull();
  });

  it('rejeita telefone brasileiro com DDI 55 e DDD invalido', () => {
    expect(normalizePhoneE164('552012345678')).toBeNull();
  });

  it('rejeita telefone brasileiro internacionalizado com DDD invalido', () => {
    expect(normalizePhoneE164('+55 20 1234-5678')).toBeNull();
  });
});
