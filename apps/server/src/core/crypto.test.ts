import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto.js';

describe('crypto settings secrets', () => {
  it('encrypt/decrypt roundtrip', () => {
    const secret = 'smtp-super-secret';
    const encrypted = encryptSecret(secret);
    const decrypted = decryptSecret(encrypted);

    expect(decrypted).toBe(secret);
  });

  it('string criptografada nao igual ao original', () => {
    const secret = 'smtp-super-secret';
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toBe(secret);
  });

  it('falha com payload invalido', () => {
    expect(() => decryptSecret('invalido')).toThrowError();
  });
});
