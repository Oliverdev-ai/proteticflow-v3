import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: !isCI,
  workers: isCI ? 1 : undefined,
  retries: isCI ? 2 : 1,
  reporter: isCI
    ? [['list'], ['junit', { outputFile: 'test-results/e2e-junit.xml' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'corepack pnpm dev',
    port: 5173,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_MANAGER_EMAIL: process.env.E2E_MANAGER_EMAIL ?? '',
      E2E_MANAGER_PASSWORD: process.env.E2E_MANAGER_PASSWORD ?? '',
      E2E_RECEPCAO_EMAIL: process.env.E2E_RECEPCAO_EMAIL ?? '',
      E2E_RECEPCAO_PASSWORD: process.env.E2E_RECEPCAO_PASSWORD ?? '',
    },
  },
});
