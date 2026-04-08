import { expect, test } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

test.describe('flow critical actions e2e', () => {
  test('comando critico abre etapa de confirmacao', async ({ page }) => {
    requireManagerE2E();
    await loginManager(page);

    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });
    await page.locator('#flow-command-input').fill('fechamento mensal 2026-04');
    await page.locator('#flow-command-send').click();

    await expect(page.getByText(/confirmacao necessaria/i)).toBeVisible({ timeout: 15000 });
  });

  test('comando critico permite cancelamento no card', async ({ page }) => {
    requireManagerE2E();
    await loginManager(page);

    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });
    await page.locator('#flow-command-input').fill('receber compra cmp-1001');
    await page.locator('#flow-command-send').click();

    await expect(page.getByText(/confirmacao necessaria/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /cancelar/i }).click();
    await expect(page.getByText(/comando cancelado/i)).toBeVisible({ timeout: 15000 });
  });
});
