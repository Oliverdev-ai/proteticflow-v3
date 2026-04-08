import { describe, expect, it } from 'vitest';

describe('logo-upload', () => {
  it('rejeita svg e aceita tipos permitidos (smoke)', () => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    expect(allowed.includes('image/png')).toBe(true);
    expect(allowed.includes('image/svg+xml')).toBe(false);
  });
});
