import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { encryptTotpSecret, isEncryptedTotpSecret } from '../../core/crypto.js';

export interface TotpSecretBackfillResult {
  scanned: number;
  encrypted: number;
  alreadyEncrypted: number;
  skipped: number;
}

export async function backfillTotpSecrets(): Promise<TotpSecretBackfillResult> {
  const rows = await db
    .select({
      id: users.id,
      twoFactorSecret: users.twoFactorSecret,
    })
    .from(users)
    .where(isNotNull(users.twoFactorSecret));

  let encryptedCount = 0;
  let alreadyEncrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    const secret = row.twoFactorSecret;
    if (!secret) {
      skipped += 1;
      continue;
    }

    if (isEncryptedTotpSecret(secret)) {
      alreadyEncrypted += 1;
      continue;
    }

    const encryptedSecret = encryptTotpSecret(secret);
    const updated = await db
      .update(users)
      .set({
        twoFactorSecret: encryptedSecret,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, row.id), eq(users.twoFactorSecret, secret)))
      .returning({ id: users.id });

    if (updated.length === 1) {
      encryptedCount += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    scanned: rows.length,
    encrypted: encryptedCount,
    alreadyEncrypted,
    skipped,
  };
}
