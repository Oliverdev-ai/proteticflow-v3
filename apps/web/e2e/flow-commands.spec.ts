import { expect, test, type Page } from '@playwright/test';

const hasManagerE2E = Boolean(process.env.E2E_MANAGER_EMAIL && process.env.E2E_MANAGER_PASSWORD);

async function loginManager(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('E-mail').fill(process.env.E2E_MANAGER_EMAIL!);
  await page.getByPlaceholder('Senha').fill(process.env.E2E_MANAGER_PASSWORD!);
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await page.waitForURL(/^\/$/, { timeout: 30000 });
}

test.describe('flow command pipeline e2e', () => {
  test('executa quick action de trabalhos pendentes', async ({ page }) => {
    test.skip(!hasManagerE2E, 'E2E manager vars nao configuradas');
    await loginManager(page);

    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /trabalhos pendentes/i }).click();

    await expect(page.getByText(/Comando jobs\.listPending executado com sucesso/i)).toBeVisible({
      timeout: 20000,
    });
  });

  test('comando transactional abre confirmacao e permite cancelar', async ({ page }) => {
    test.skip(!hasManagerE2E, 'E2E manager vars nao configuradas');
    await loginManager(page);

    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });
    await page.locator('#flow-command-input').fill('suspender os 321 por aguardando material');
    await page.locator('#flow-command-send').click();

    await expect(page.getByText(/Confirmacao necessaria/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /cancelar/i }).click();
    await expect(page.getByText(/Comando cancelado/i)).toBeVisible({ timeout: 15000 });
  });
});

