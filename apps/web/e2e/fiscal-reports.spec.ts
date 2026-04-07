import { expect, test, type Page } from '@playwright/test';

const hasE2E = Boolean(process.env.E2E_MANAGER_EMAIL && process.env.E2E_MANAGER_PASSWORD);

async function loginManager(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('E-mail').fill(process.env.E2E_MANAGER_EMAIL!);
  await page.getByPlaceholder('Senha').fill(process.env.E2E_MANAGER_PASSWORD!);
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await page.waitForURL(/^\/$/, { timeout: 30000 });
}

test.describe('fiscal reports', () => {
  test('navega para faturamento fiscal e renderiza tabela', async ({ page }) => {
    test.skip(!hasE2E, 'E2E manager vars nao configuradas');

    await loginManager(page);
    await page.goto('/relatorios/faturamento', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /faturamento por periodo/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/por dentista/i)).toBeVisible({ timeout: 15000 });
  });

  test('exporta CSV no relatorio fiscal', async ({ page }) => {
    test.skip(!hasE2E, 'E2E manager vars nao configuradas');

    await loginManager(page);
    await page.goto('/relatorios/faturamento', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /exportar csv/i })).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /exportar csv/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/fiscal-revenue-.*\.csv/i);
  });
});
