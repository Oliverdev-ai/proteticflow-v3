import { env } from '../env.js';
import * as bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { JwtPayload } from '@proteticflow/shared';

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
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN || '15m')
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
  return payload as unknown as JwtPayload;
}

// hashToken(token: string): string
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// generate2faSecret(email: string): { secret: string; otpauthUrl: string }
export function generate2faSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, 'ProteticFlow', secret);
  return { secret, otpauthUrl };
}

// verify2faCode(secret: string, code: string): boolean
export function verify2faCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

// generateQrCode(otpauthUrl: string): Promise<string>
export async function generateQrCode(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl);
}
