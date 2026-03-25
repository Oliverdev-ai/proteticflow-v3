import { describe, expect, it } from 'vitest';
import { __testOnly } from './service.js';

describe('notifications service helpers', () => {
  it('normaliza tipos de notificacao para enum persistido', () => {
    expect(__testOnly.normalizeType('info')).toBe('info');
    expect(__testOnly.normalizeType('warning')).toBe('warning');
    expect(__testOnly.normalizeType('error')).toBe('error');
  });
});
