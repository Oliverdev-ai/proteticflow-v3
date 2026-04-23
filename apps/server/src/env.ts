import { z } from 'zod';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  // Node keeps the first loaded value, so prefer the package-local env in dev.
  resolve(currentDir, '../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/server/.env'),
];

for (const candidate of envCandidates) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalText = () => z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalEmail = () => z.preprocess(emptyToUndefined, z.string().email().optional());
const optionalNumber = () => z.preprocess(emptyToUndefined, z.coerce.number().optional());
const optionalUrl = () => z.preprocess(emptyToUndefined, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_BUCKET: z.string().default('proteticflow'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin123'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  JWT_SECRET: z.string().min(32),
  SETTINGS_SECRET_KEY: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_REQUIRED: z.coerce.boolean().default(false),
  SMTP_HOST: optionalText(),
  SMTP_PORT: optionalNumber(),
  SMTP_USER: optionalText(),
  SMTP_PASS: optionalText(),
  SMTP_FROM: optionalEmail(),
  VAPID_PUBLIC_KEY: optionalText(),
  VAPID_PRIVATE_KEY: optionalText(),
  VAPID_SUBJECT: optionalText(),
  GEMINI_API_KEY: optionalText(),
  GEMINI_MODEL: optionalText(),
  ANTHROPIC_API_KEY: optionalText(),
  ANTHROPIC_MODEL: optionalText(),
  GCP_TTS_API_KEY: optionalText(),
  GCP_TTS_VOICE_DEFAULT: optionalText(),
  GCP_TTS_VOICE_MALE: optionalText(),
  OPENAI_API_KEY: optionalText(),
  STRIPE_SECRET_KEY: optionalText(),
  STRIPE_WEBHOOK_SECRET: optionalText(),
  STRIPE_PRICE_STARTER: optionalText(),
  STRIPE_PRICE_PRO: optionalText(),
  STRIPE_PRICE_ENTERPRISE: optionalText(),
  ASAAS_API_KEY: optionalText(),
  ASAAS_SANDBOX: optionalText(),
  FOCUS_NFE_TOKEN: optionalText(),
  FOCUS_NFE_SANDBOX: optionalText(),
  SENTRY_DSN: optionalUrl(),
  BACKUP_S3_BUCKET: optionalText(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variaveis de ambiente invalidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
