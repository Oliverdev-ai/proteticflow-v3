import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../env.js';
import { logger } from '../logger.js';

const ALGO = 'aes-256-gcm';
const TOTP_SECRET_V1_PREFIX = `totp:v1:${ALGO}`;

function resolveKey(): Buffer {
  if (!env.SETTINGS_SECRET_KEY || env.SETTINGS_SECRET_KEY.length < 32) {
    throw new Error('SETTINGS_SECRET_KEY nao configurada ou invalida (minimo 32 caracteres)');
  }
  return createHash('sha256').update(env.SETTINGS_SECRET_KEY).digest();
}

function encryptAesGcmHex(plaintext: string): { ivHex: string; tagHex: string; payloadHex: string } {
  const iv = randomBytes(12);
  const key = resolveKey();
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ivHex: iv.toString('hex'),
    tagHex: authTag.toString('hex'),
    payloadHex: encrypted.toString('hex'),
  };
}

function decryptAesGcmHex(ivHex: string | undefined, tagHex: string | undefined, payloadHex: string | undefined): string {
  if (!ivHex || !tagHex || !payloadHex) {
    throw new Error('Formato de segredo invalido');
  }

  const key = resolveKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function encryptSecret(plaintext: string): string {
  const encrypted = encryptAesGcmHex(plaintext);
  return `${encrypted.ivHex}:${encrypted.tagHex}:${encrypted.payloadHex}`;
}

export function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, payloadHex] = ciphertext.split(':');
  return decryptAesGcmHex(ivHex, tagHex, payloadHex);
}

export function encryptTotpSecret(plaintext: string): string {
  const encrypted = encryptAesGcmHex(plaintext);
  return `${TOTP_SECRET_V1_PREFIX}:${encrypted.ivHex}:${encrypted.tagHex}:${encrypted.payloadHex}`;
}

export function isEncryptedTotpSecret(value: string): boolean {
  return value.startsWith(`${TOTP_SECRET_V1_PREFIX}:`);
}

export function decryptTotpSecret(ciphertext: string): string {
  const [scope, version, algo, ivHex, tagHex, payloadHex] = ciphertext.split(':');
  if (scope !== 'totp' || version !== 'v1' || algo !== ALGO) {
    throw new Error('Formato de segredo TOTP invalido');
  }
  return decryptAesGcmHex(ivHex, tagHex, payloadHex);
}

export function decryptTotpSecretAtRest(value: string): string {
  if (isEncryptedTotpSecret(value)) {
    return decryptTotpSecret(value);
  }

  logger.warn(
    { action: 'auth.2fa_secret.legacy_plaintext_detected', format: 'legacy_plaintext' },
    'Plaintext TOTP secret detected; run backfill:2fa-secrets',
  );
  return value;
}
