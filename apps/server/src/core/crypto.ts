import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../env.js';

const ALGO = 'aes-256-gcm';

function resolveKey(): Buffer {
  if (!env.SETTINGS_SECRET_KEY || env.SETTINGS_SECRET_KEY.length < 32) {
    throw new Error('SETTINGS_SECRET_KEY nao configurada ou invalida (minimo 32 caracteres)');
  }
  return createHash('sha256').update(env.SETTINGS_SECRET_KEY).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const key = resolveKey();
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, payloadHex] = ciphertext.split(':');
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
