import { env } from '../env.js';
import * as bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import qrcode from 'qrcode';
import { JwtPayload } from '@proteticflow/shared';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bufferToBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32ToBuffer(secret: string): Buffer {
  const normalized = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function computeTotp(secret: string, counter: number): string {
  const decoded = base32ToBuffer(secret);
  const key = decoded.length > 0 ? decoded : Buffer.from(secret, 'utf8');
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = (
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  );
  return String(binary % 1_000_000).padStart(6, '0');
}

// hashPassword(password: string): Promise<string>
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// verifyPassword(password: string, hash: string): Promise<boolean>
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// generateAccessToken(payload: JwtPayload): Promise<string>
export async function generateAccessToken(payload: JwtPayload): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);
  const iat = payload.iat ?? now;
  const exp = payload.exp ?? (now + 15 * 60);

  return new SignJWT({
    tenantId: payload.tenantId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.sub))
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secret);
}

// generateRefreshToken(): string
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// verifyAccessToken(token: string): Promise<JwtPayload>
export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  const now = Math.floor(Date.now() / 1000);
  const sub = Number(payload.sub);

  if (Number.isNaN(sub)) {
    throw new Error('Invalid token subject');
  }

  return {
    sub,
    tenantId: Number(payload.tenantId ?? 0),
    role: String(payload.role ?? 'recepcao'),
    iat: typeof payload.iat === 'number' ? payload.iat : now,
    exp: typeof payload.exp === 'number' ? payload.exp : now + 15 * 60,
  };
}

// hashToken(token: string): string
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// generate2faSecret(email: string): { secret: string; otpauthUrl: string }
export function generate2faSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = bufferToBase32(crypto.randomBytes(20));
  const issuer = encodeURIComponent('ProteticFlow');
  const label = encodeURIComponent(email);
  const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return { secret, otpauthUrl };
}

// verify2faCode(secret: string, code: string): boolean
export function verify2faCode(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (let drift = -1; drift <= 1; drift++) {
    if (computeTotp(secret, counter + drift) === code) {
      return true;
    }
  }
  return false;
}

// generateQrCode(otpauthUrl: string): Promise<string>
export async function generateQrCode(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl);
}
