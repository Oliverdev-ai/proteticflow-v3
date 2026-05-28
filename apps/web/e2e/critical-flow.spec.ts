import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { loginManager } from './support/auth';

function uniqueSuffix() {
  return randomUUID().slice(0, 8);
}

function futureDate(daysAhead: number) {
  const value = new Date();
  value.setDate(value.getDate() + daysAhead);
  return value.toISOString().slice(0, 10);
}

function extractIdFromUrl(currentUrl: string, entity: 'cliente' | 'trabalho') {
  const matcher = entity === 'cliente' ? /\/clientes\/(\d+)(?:\/|$)/ : /\/trabalhos\/(\d+)(?:\/|$)/;
  const match = currentUrl.match(matcher);

  if (!match || !match[1]) {
    throw new Error(`Nao foi possivel extrair id de ${entity} da URL: ${currentUrl}`);
  }

  const id = Number.parseInt(match[1], 10);
  if (!Number.isFinite(id)) {
    throw new Error(`ID invalido de ${entity} extraido da URL: ${currentUrl}`);
  }

  return id;
}

async function createClient(page: Page) {
  const suffix = uniqueSuffix();
  const clientName = `Cliente E2E ${suffix}`;

  await page.goto('/clientes/novo', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('input-client-name').fill(clientName);
  await page.getByTestId('select-document-type').selectOption('cpf');
  await page.getByTestId('textarea-technical-preferences').fill(`Preferencias recorrentes ${suffix}`);
  await page.getByTestId('btn-create-client').click();
  await page.waitForURL(/\/clientes\/\d+$/, { timeout: 20_000 });

  const clientId = extractIdFromUrl(page.url(), 'cliente');
  return { clientId, clientName, suffix };
}

async function createJobForClient(page: Page, clientId: number, suffix: string) {
  const patientName = `Paciente ${suffix}`;

  await page.goto('/trabalhos/novo', { waitUntil: 'domcontentloaded' });
  await page.getByTestId(`client-option-${clientId}`).click();
  await page.getByTestId('btn-step-next').click();

  await page.getByTestId('btn-add-manual-item').click();
  await page.getByTestId('input-item-name-0').fill(`Servico E2E ${suffix}`);
  await page.getByTestId('input-item-unit-price-0').fill('23000');
  await page.getByTestId('btn-step-next').click();

  await page.getByTestId('input-patient-name').fill(patientName);
  await page.getByTestId('input-job-deadline').fill(futureDate(4));
  await page.getByTestId('btn-step-next').click();

  await page.getByTestId('btn-create-job').click();
  await page.waitForURL(/\/trabalhos\/\d+$/, { timeout: 20_000 });

  const jobId = extractIdFromUrl(page.url(), 'trabalho');
  return { jobId, patientName };
}

test.describe('fluxo critico e2e', () => {
  test.beforeEach(async ({ page }) => {
    await loginManager(page);
  });

  test('cria cliente com seletores estaveis', async ({ page }) => {
    const { clientId } = await createClient(page);
    expect(clientId).toBeGreaterThan(0);
  });

  test('cria OS e valida card no kanban', async ({ page }) => {
    const { clientId, suffix } = await createClient(page);
    const { jobId } = await createJobForClient(page, clientId, suffix);

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(`kanban-card-${jobId}`)).toBeVisible({ timeout: 15_000 });
  });

  test('carrega dashboard financeiro com ancoras estaveis', async ({ page }) => {
    await page.goto('/financeiro', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-financial-dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('finance-module-ar')).toBeVisible({ timeout: 15_000 });
  });

  test('gera token de portal e valida acesso publico', async ({ page }) => {
    const { clientId, clientName } = await createClient(page);

    await page.goto(`/clientes/${clientId}/portal`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/clientes\/\d+\/portal$/, { timeout: 15_000 });

    await page.getByTestId('btn-generate-portal-token').click();
    const portalUrlLocator = page.getByTestId('portal-url');
    await expect(portalUrlLocator).toBeVisible({ timeout: 15_000 });

    const portalUrl = (await portalUrlLocator.textContent())?.trim();
    expect(portalUrl).toBeTruthy();

    const portalPath = new URL(portalUrl!).pathname;
    await page.goto(portalPath, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/portal\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByTestId('portal-client-name')).toContainText(clientName);
  });
});
