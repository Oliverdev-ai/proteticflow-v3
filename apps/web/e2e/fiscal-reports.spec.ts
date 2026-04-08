import { expect, test } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

test.describe('fiscal reports', () => {
  test('navega para faturamento fiscal e renderiza tabela', async ({ page }) => {
    requireManagerE2E();

    await loginManager(page);
    await page.goto('/relatorios/faturamento', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /faturamento por periodo/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/por dentista/i)).toBeVisible({ timeout: 15000 });
  });

  test('exporta CSV no relatorio fiscal', async ({ page }) => {
    requireManagerE2E();

    await loginManager(page);
    await page.goto('/relatorios/faturamento', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /exportar csv/i })).toBeVisible({
      timeout: 15000,
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /exportar csv/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/fiscal-revenue-.*\.csv/i);
  });
});
