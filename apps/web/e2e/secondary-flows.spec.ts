import { expect, test } from '@playwright/test';

const hasManagerE2E = Boolean(process.env.E2E_MANAGER_EMAIL && process.env.E2E_MANAGER_PASSWORD);

test.describe('fluxos secundarios e2e', () => {
  test('login invalido mostra erro', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('E-mail').fill('usuario.invalido@example.com');
    await page.getByPlaceholder('Senha').fill('senha-errada');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page.getByText(/credenciais|erro|incorreto|inv[aá]lid/i)).toBeVisible({ timeout: 10000 });
  });

  test('rota protegida sem auth redireciona para login', async ({ page }) => {
    await page.goto('/clientes', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('landing publica carrega com seo e cta', async ({ page }) => {
    await page.goto('/landing', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: /^proteticflow/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /comece gr.tis/i })).toBeVisible();
  });

  test('estoque: criar material e visualizar na lista', async ({ page }) => {
    test.skip(!hasManagerE2E, 'E2E manager vars nao configuradas');

    const suffix = Date.now().toString().slice(-6);
    const materialName = `Material E2E ${suffix}`;

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('E-mail').fill(process.env.E2E_MANAGER_EMAIL!);
    await page.getByPlaceholder('Senha').fill(process.env.E2E_MANAGER_PASSWORD!);
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await page.waitForURL(/^\/$/, { timeout: 20000 });

    await page.goto('/estoque/materiais', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /novo material/i }).click();
    await page.locator('input').first().fill(materialName);
    await page.getByRole('button', { name: /^criar$/i }).click();
    await expect(page.getByText(materialName, { exact: false })).toBeVisible({ timeout: 15000 });
  });
});

