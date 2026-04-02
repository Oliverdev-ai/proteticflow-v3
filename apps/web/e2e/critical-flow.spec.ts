import { expect, test } from '@playwright/test';

function uniqueSuffix() {
  return Date.now().toString().slice(-8);
}

test.describe('fluxo critico e2e', () => {
  test('registro -> onboarding -> dashboard -> cliente -> os -> kanban -> portal', async ({ page }) => {
    const suffix = uniqueSuffix();
    const userName = `Gestor E2E ${suffix}`;
    const email = `e2e.critical.${suffix}@example.com`;
    const password = `Senha${suffix}A1`;
    const labName = `Lab E2E ${suffix}`;
    const clientName = `Cliente E2E ${suffix}`;
    const patientName = `Paciente ${suffix}`;

    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Nome').fill(userName);
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill(password);
    await page.getByRole('button', { name: /registrar/i }).click();

    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30000 });

    await page.getByPlaceholder('Ex: Lab Dental Silva').fill(labName);
    await page.getByPlaceholder('Cidade').fill('Sao Paulo');
    await page.getByPlaceholder('UF').fill('SP');
    await page.getByRole('button', { name: /criar laborat/i }).click();

    if (page.url().includes('/onboarding')) {
      await expect
        .poll(async () => {
          const heading = (await page.locator('h1').first().textContent())?.trim() ?? '';
          return heading;
        }, { timeout: 20000 })
        .toMatch(/passo 2|dashboard|onboarding concluido/i);

      await expect(page.getByRole('heading', { name: /passo 2/i })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: /continuar onboarding/i }).click();
      await expect(page.getByRole('heading', { name: /passo 3/i })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: /finalizar onboarding/i }).click();
      await expect(page.getByRole('heading', { name: /onboarding concluido/i })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: /acessar o painel/i }).click();
    }

    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    await expect(
      page.getByRole('heading', { name: /dashboard/i }).or(
        page.getByText(/n.o foi poss.vel carregar o dashboard/i),
      ),
    ).toBeVisible({ timeout: 20000 });

    await page.goto('/clientes/novo', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder(/nome do cliente/i).fill(clientName);
    await page.getByRole('button', { name: /criar cliente/i }).click();
    await expect(page).toHaveURL(/\/clientes\/\d+$/, { timeout: 20000 });
    await expect(page.getByText(clientName, { exact: false })).toBeVisible();

    await page.goto('/trabalhos/novo', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: new RegExp(clientName, 'i') }).first().click();
    await page.getByRole('button', { name: /pr.ximo/i }).click();

    await page.getByRole('button', { name: /adicionar item avulso/i }).click();
    await page.getByPlaceholder(/nome do servi/i).fill('Servico E2E');
    await page.locator('input[placeholder="Centavos"]').fill('23000');
    await page.getByRole('button', { name: /pr.ximo/i }).click();

    const deadlineInput = page.locator('input[type="date"]').first();
    await deadlineInput.fill(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    await page.getByRole('textbox').first().fill(patientName);
    await page.getByRole('button', { name: /pr.ximo/i }).click();

    await page.getByRole('button', { name: /criar os/i }).click();
    await expect(page).toHaveURL(/\/trabalhos\/\d+$/, { timeout: 20000 });

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /kanban/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(patientName)).toBeVisible({ timeout: 15000 });

    await page.goto('/financeiro', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /financeiro/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/contas a receber/i)).toBeVisible({ timeout: 15000 });

    await page.goto('/clientes', { waitUntil: 'domcontentloaded' });
    await page.getByText(clientName).first().click();
    await expect(page).toHaveURL(/\/clientes\/\d+$/, { timeout: 15000 });
    await page.getByRole('button', { name: /portal/i }).click();
    await expect(page).toHaveURL(/\/clientes\/\d+\/portal$/, { timeout: 15000 });

    await page.getByRole('button', { name: /gerar token/i }).click();
    const portalUrlLocator = page.locator('[data-testid="portal-url"]');
    await expect(portalUrlLocator).toBeVisible({ timeout: 15000 });
    const portalUrl = (await portalUrlLocator.textContent())?.trim();
    expect(portalUrl).toBeTruthy();

    const portalPath = new URL(portalUrl!).pathname;
    await page.goto(portalPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(clientName, { exact: false })).toBeVisible({ timeout: 15000 });
  });
});

