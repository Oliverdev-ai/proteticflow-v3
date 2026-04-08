import { test, expect } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

test.describe('simulador de precos', () => {
  test('pagina de simulador carrega corretamente', async ({ page }) => {
    requireManagerE2E();
    await loginManager(page);

    await page.goto('/simulador', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/simulador|simula..o|or.amento/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('simulador - acesso sem auth', () => {
  test('rota responde com login ou pagina publica do simulador', async ({ page }) => {
    await page.goto('/simulador', { waitUntil: 'domcontentloaded' });

    await expect.poll(async () => page.url(), { timeout: 10000 }).toMatch(/\/(login|simulador)/);

    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });
});
