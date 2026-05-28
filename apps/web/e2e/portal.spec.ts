import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { loginManager } from './support/auth';

function uniqueSuffix() {
  return randomUUID().slice(0, 8);
}

function extractClientId(currentUrl: string) {
  const match = currentUrl.match(/\/clientes\/(\d+)(?:\/|$)/);
  if (!match || !match[1]) {
    throw new Error(`Nao foi possivel extrair id do cliente da URL: ${currentUrl}`);
  }
  return Number.parseInt(match[1], 10);
}

async function createClient(page: Page, clientName: string) {
  await page.goto('/clientes/novo', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('input-client-name').fill(clientName);
  await page.getByTestId('select-document-type').selectOption('cpf');
  await page.getByTestId('btn-create-client').click();
  await page.waitForURL(/\/clientes\/\d+$/, { timeout: 20_000 });
  return extractClientId(page.url());
}

test.describe('portal do cliente — erros públicos', () => {
  test('token inválido exibe erro público', async ({ page }) => {
    await page.goto('/portal/token-invalido-abc123', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-public-portal')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('portal-error')).toBeVisible({ timeout: 10_000 });
  });

  test('token sintaticamente válido mas inexistente exibe erro', async ({ page }) => {
    const fakeToken = 'f'.repeat(64);
    await page.goto(`/portal/${fakeToken}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-public-portal')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('portal-error')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('portal do cliente — fluxo completo', () => {
  test.beforeEach(async ({ page }) => {
    await loginManager(page);
  });

  test('gerente gera token, abre portal e snapshot público não expõe dados financeiros', async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const clientName = `Cliente Portal ${suffix}`;
    const clientId = await createClient(page, clientName);

    await page.goto(`/clientes/${clientId}/portal`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/clientes\/\d+\/portal$/, { timeout: 15_000 });
    await page.getByTestId('btn-generate-portal-token').click();

    const portalUrlLocator = page.getByTestId('portal-url');
    await expect(portalUrlLocator).toBeVisible({ timeout: 15_000 });
    const portalUrl = (await portalUrlLocator.textContent())?.trim();
    expect(portalUrl).toBeTruthy();
    expect(portalUrl).toContain('/portal/');

    const portalPath = new URL(portalUrl!).pathname;
    await page.goto(portalPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-public-portal')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('portal-client-name')).toContainText(clientName);

    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText).not.toMatch(/totalCents|discountCents|taxCents|preco_total|valor_total/i);
  });
});
