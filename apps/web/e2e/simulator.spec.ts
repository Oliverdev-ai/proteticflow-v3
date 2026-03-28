import { test, expect } from '@playwright/test';

const hasE2E = Boolean(process.env.E2E_MANAGER_EMAIL && process.env.E2E_MANAGER_PASSWORD);

test.describe('simulador de preços', () => {
  test.skip(!hasE2E, 'E2E vars não configuradas');

  test('página de simulador carrega corretamente', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('E-mail').fill(process.env.E2E_MANAGER_EMAIL!);
    await page.getByPlaceholder('Senha').fill(process.env.E2E_MANAGER_PASSWORD!);
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await page.waitForURL('/', { timeout: 15000 });

    // Navegar para simulador
    await page.goto('/simulador', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/simulador|simulação|orçamento/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('simulador — erros sem auth', () => {
  test('redireciona para login se não autenticado', async ({ page }) => {
    await page.goto('/simulador', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
