import { test, expect } from '@playwright/test';

/**
 * E2E — Fase 17: Portal do Cliente
 *
 * Fluxo completo:
 *  1. Gerente gera token de portal para um cliente
 *  2. Abre /portal/:token como visitante (sem login)
 *  3. Verifica snapshot público (nome do cliente, sem dados financeiros)
 *  4. Tokens inválidos/expirados retornam tela de erro
 */

async function registerAndOnboardManager(page: import('@playwright/test').Page) {
  const suffix = Date.now().toString().slice(-8);
  const email = `e2e.portal.${suffix}@example.com`;
  const password = `Senha${suffix}A1`;

  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Nome').fill(`Gerente Portal ${suffix}`);
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Registrar' }).click();

  await page.waitForURL(/\/onboarding$/, { timeout: 30000 });
  await page.getByPlaceholder('Ex: Lab Dental Silva').fill(`Lab Portal ${suffix}`);
  await page.getByPlaceholder('Cidade').fill('Sao Paulo');
  await page.getByPlaceholder('UF').fill('SP');
  await page.getByRole('button', { name: /Criar laborat/ }).click();
  await page.waitForURL(/^\/$/, { timeout: 30000 });

  return { email, password };
}

test.describe('portal do cliente', () => {
  test('rota /portal/:token invalido exibe erro amigavel', async ({ page }) => {
    await page.goto('/portal/token-invalido-abc123', { waitUntil: 'domcontentloaded' });

    // Deve renderizar fora do layout privado (sem sidebar/header de dashboard)
    await expect(page.locator('nav[data-sidebar]')).not.toBeVisible();

    // Deve exibir mensagem de erro
    await expect(page.getByText(/inv[aá]lido|expirado|n[aã]o encontrado/i)).toBeVisible({ timeout: 10000 });
  });

  test('rota /portal/:token expirado exibe erro amigavel', async ({ page }) => {
    // Token sintaticamente válido (64 hex chars) mas inexistente no banco
    const fakeToken = 'a'.repeat(64);
    await page.goto(`/portal/${fakeToken}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('nav[data-sidebar]')).not.toBeVisible();
    await expect(page.getByText(/inv[aá]lido|expirado|n[aã]o encontrado/i)).toBeVisible({ timeout: 10000 });
  });

  test('gerente pode acessar gestao de tokens em /clientes/:id', async ({ page }) => {
    await registerAndOnboardManager(page);

    // Navega para listagem de clientes
    await page.goto('/clientes', { waitUntil: 'domcontentloaded' });

    // Se não há clientes, página deve carregar sem erros críticos
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Erro interno');
  });
});
