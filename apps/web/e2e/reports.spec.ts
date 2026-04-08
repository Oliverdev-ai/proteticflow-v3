import { test, expect } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

test.describe('relatorios', () => {
  test('pagina de relatorios carrega corretamente', async ({ page }) => {
    requireManagerE2E();
    await loginManager(page);

    await page.goto('/relatorios', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/relat.rio|relat.rios/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('relatorios - acesso sem auth', () => {
  test('rota responde com login ou pagina publica de relatorios', async ({ page }) => {
    await page.goto('/relatorios', { waitUntil: 'domcontentloaded' });

    await expect.poll(async () => page.url(), { timeout: 10000 }).toMatch(/\/(login|relatorios)/);

    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });
});
