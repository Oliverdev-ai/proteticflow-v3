import { expect, test, type Page } from '@playwright/test';

const hasManagerE2E = Boolean(process.env.E2E_MANAGER_EMAIL && process.env.E2E_MANAGER_PASSWORD);

async function loginManager(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('E-mail').fill(process.env.E2E_MANAGER_EMAIL!);
  await page.getByPlaceholder('Senha').fill(process.env.E2E_MANAGER_PASSWORD!);
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await page.waitForURL(/^\/$/, { timeout: 30000 });
}

test.describe('flow critical actions e2e', () => {
  test('comando critico abre etapa de confirmacao', async ({ page }) => {
    test.skip(!hasManagerE2E, 'E2E manager vars nao configuradas');
    await loginManager(page);

    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });
    await page.locator('#flow-command-input').fill('fechamento mensal 2026-04');
    await page.locator('#flow-command-send').click();

    await expect(page.getByText(/confirmacao necessaria/i)).toBeVisible({ timeout: 15000 });
  });

  test('comando critico permite cancelamento no card', async ({ page }) => {
    test.skip(!hasManagerE2E, 'E2E manager vars nao configuradas');
    await loginManager(page);

    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });
    await page.locator('#flow-command-input').fill('receber compra cmp-1001');
    await page.locator('#flow-command-send').click();

    await expect(page.getByText(/confirmacao necessaria/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /cancelar/i }).click();
    await expect(page.getByText(/comando cancelado/i)).toBeVisible({ timeout: 15000 });
  });
});

