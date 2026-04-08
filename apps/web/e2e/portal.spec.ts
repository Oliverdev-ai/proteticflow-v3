import { test, expect } from '@playwright/test';

/**
 * E2E — Fase 17: Portal do Cliente
 *
 * Cobre:
 *  1. Token inválido → tela de erro fora do layout privado
 *  2. Fluxo completo: register → onboard → criar cliente → gerar token
 *     → abrir /portal/:token → verificar snapshot público sem dados financeiros
 */

async function registerAndOnboard(page: import('@playwright/test').Page) {
  const suffix = Date.now().toString().slice(-8);
  const email = `e2e.portal.${suffix}@example.com`;
  const password = `Senha${suffix}A1`;
  const labName = `Lab Portal ${suffix}`;
  const clientName = `Cliente Portal ${suffix}`;

  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Nome').fill(`Gerente Portal ${suffix}`);
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding$/, { timeout: 30000 });

  await page.getByPlaceholder('Ex: Lab Dental Silva').fill(labName);
  await page.getByPlaceholder('Cidade').fill('Sao Paulo');
  await page.getByPlaceholder('UF').fill('SP');
  await page.getByRole('button', { name: /Criar laborat/ }).click();
  await page.waitForURL(/^\/$/, { timeout: 30000 });

  return { email, password, clientName };
}

async function createClient(page: import('@playwright/test').Page, clientName: string) {
  await page.goto('/clientes/novo', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/nome/i).fill(clientName);
  await page.getByRole('button', { name: /salvar|criar|adicionar/i }).click();
  // Aguarda redirecionamento para a lista ou detalhe do cliente
  await page.waitForURL(/\/clientes/, { timeout: 15000 });
}

test.describe('portal do cliente — erros públicos', () => {
  test('token inválido exibe erro fora do layout privado', async ({ page }) => {
    await page.goto('/portal/token-invalido-abc123', { waitUntil: 'domcontentloaded' });

    // Rota pública — sem sidebar de dashboard
    await expect(page.locator('[data-sidebar], nav.sidebar, aside.sidebar')).not.toBeVisible();
    await expect(page.getByText(/inv[aá]lido|expirado|n[aã]o encontrado/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('token sintaticamente válido mas inexistente exibe erro', async ({ page }) => {
    const fakeToken = 'f'.repeat(64);
    await page.goto(`/portal/${fakeToken}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-sidebar], nav.sidebar, aside.sidebar')).not.toBeVisible();
    await expect(page.getByText(/inv[aá]lido|expirado|n[aã]o encontrado/i)).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('portal do cliente — fluxo completo', () => {
  test('gerente gera token, abre portal, snapshot público não expõe dados financeiros', async ({
    page,
  }) => {
    const { clientName } = await registerAndOnboard(page);

    // Cria cliente via UI
    await createClient(page, clientName);

    // Navega para o primeiro cliente e depois para gestão do portal
    await page.goto('/clientes', { waitUntil: 'domcontentloaded' });
    const clientLink = page.getByText(clientName).first();
    await expect(clientLink).toBeVisible({ timeout: 10000 });
    await clientLink.click();
    await page.waitForURL(/\/clientes\/\d+/, { timeout: 10000 });

    // Clica no botão de gestão do portal
    const portalButton = page.getByRole('button', { name: /portal/i });
    await expect(portalButton).toBeVisible({ timeout: 5000 });
    await portalButton.click();
    await page.waitForURL(/\/clientes\/\d+\/portal/, { timeout: 10000 });

    // Gera token
    await page.getByRole('button', { name: /gerar token/i }).click();

    // Captura a URL do portal gerada
    const portalUrlLocator = page.locator('[data-testid="portal-url"]');
    await expect(portalUrlLocator).toBeVisible({ timeout: 10000 });
    const portalUrl = await portalUrlLocator.textContent();
    expect(portalUrl).toBeTruthy();
    expect(portalUrl).toContain('/portal/');

    // Extrai o path /portal/:token da URL completa
    const portalPath = new URL(portalUrl!).pathname;

    // Navega para o portal público (sem autenticação necessária)
    await page.goto(portalPath, { waitUntil: 'domcontentloaded' });

    // Deve estar fora do layout privado
    await expect(page.locator('[data-sidebar], nav.sidebar, aside.sidebar')).not.toBeVisible();

    // Deve mostrar nome do cliente
    await expect(page.getByText(clientName, { exact: false })).toBeVisible({ timeout: 10000 });

    // Não deve expor campos financeiros sensíveis
    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText).not.toMatch(/totalCents|discountCents|taxCents|preco_total|valor_total/i);
  });
});
