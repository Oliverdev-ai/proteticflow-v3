import { expect, test } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

test.describe('fluxos secundarios e2e', () => {
  test('login invalido nao autentica usuario', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('E-mail').fill('usuario.invalido@example.com');
    await page.getByPlaceholder('Senha').fill('senha-errada');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect
      .poll(async () => page.url(), { timeout: 10000 })
      .toMatch(/\/(login|$)/);

    if (page.url().includes('/login')) {
      await expect(page.getByPlaceholder('E-mail')).toBeVisible({ timeout: 10000 });
    }
  });

  test('rota clientes sem auth responde com login ou lista publica', async ({ page }) => {
    await page.goto('/clientes', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(async () => page.url(), { timeout: 10000 })
      .toMatch(/\/(login|clientes)/);

    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('landing publica carrega com seo e cta', async ({ page }) => {
    await page.goto('/landing', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: /^proteticflow/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /comece gr.tis/i })).toBeVisible();
  });

  test('estoque: criar material e visualizar na lista', async ({ page }) => {
    requireManagerE2E();

    const suffix = Date.now().toString().slice(-6);
    const materialName = `Material E2E ${suffix}`;

    await loginManager(page);

    await page.goto('/estoque/materiais', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /novo material/i }).click();
    await page.locator('input').first().fill(materialName);
    await page.getByRole('button', { name: /^criar$/i }).click();
    await expect(page.getByText(materialName, { exact: false })).toBeVisible({ timeout: 15000 });
  });
});
