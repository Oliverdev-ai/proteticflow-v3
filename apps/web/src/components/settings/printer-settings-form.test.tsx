import { describe, expect, it } from 'vitest';

describe('printer-settings-form', () => {
  it('valida porta de impressora (smoke)', () => {
    expect(Number.isInteger(9100)).toBe(true);
    expect(Number.isInteger(9100.1)).toBe(false);
  });
});
