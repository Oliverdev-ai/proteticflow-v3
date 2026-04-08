import { describe, expect, it } from 'vitest';

describe('branding-form', () => {
  it('hex valido e invalido (smoke)', () => {
    expect(/^#[0-9A-Fa-f]{6}$/.test('#112233')).toBe(true);
    expect(/^#[0-9A-Fa-f]{6}$/.test('112233')).toBe(false);
  });
});
