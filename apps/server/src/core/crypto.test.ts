import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  decryptTotpSecretAtRest,
  encryptSecret,
  encryptTotpSecret,
  isEncryptedTotpSecret,
} from './crypto.js';

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

describe('crypto totp secrets', () => {
  it('usa formato versionado AES-256-GCM', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptTotpSecret(secret);

    expect(encrypted).toMatch(/^totp:v1:aes-256-gcm:/);
    expect(encrypted).not.toBe(secret);
    expect(isEncryptedTotpSecret(encrypted)).toBe(true);
    expect(decryptTotpSecretAtRest(encrypted)).toBe(secret);
  });

  it('mantem compatibilidade com segredo TOTP legado em plaintext', () => {
    const legacySecret = 'JBSWY3DPEHPK3PXP';

    expect(isEncryptedTotpSecret(legacySecret)).toBe(false);
    expect(decryptTotpSecretAtRest(legacySecret)).toBe(legacySecret);
  });
});
