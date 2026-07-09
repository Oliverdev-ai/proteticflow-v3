#!/usr/bin/env tsx

import { backfillTotpSecrets } from '../apps/server/src/modules/auth/totp-secret-backfill.js';

async function main(): Promise<void> {
  const result = await backfillTotpSecrets();
  console.log(JSON.stringify({ action: 'backfill:2fa-secrets', ...result }, null, 2));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
