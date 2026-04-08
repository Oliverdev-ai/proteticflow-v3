import { expect, test, type Page } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

function suffix() {
  return Date.now().toString().slice(-7);
}

async function createClient(page: Page, clientName: string) {
  await page.goto('/clientes/novo', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/nome do cliente/i).fill(clientName);
  await page.getByRole('button', { name: /criar cliente/i }).click();
  await expect(page).toHaveURL(/\/clientes\/\d+$/, { timeout: 20000 });
}

type CreatedJob = {
  id: number;
  code: string;
};

async function createJob(page: Page, clientName: string, patientName: string): Promise<CreatedJob> {
  await page.goto('/trabalhos/novo', { waitUntil: 'domcontentloaded' });

  await page
    .getByRole('button', { name: new RegExp(clientName, 'i') })
    .first()
    .click();
  await page.getByRole('button', { name: /pr.xima etapa|pr.ximo/i }).click();

  await page.getByRole('button', { name: /adicionar manualmente|adicionar item avulso/i }).click();
  await page.getByPlaceholder(/descri..o do servi/i).fill(`Servico Subtype ${suffix()}`);

  const row = page
    .locator('input[placeholder*="Descrição"], input[placeholder*="Descri"]')
    .first()
    .locator('xpath=ancestor::div[contains(@class,"group")]')
    .first();
  await row.locator('input[type="number"]').nth(1).fill('250');

  await page.getByRole('button', { name: /pr.xima etapa|pr.ximo/i }).click();

  const deadlineInput = page.locator('input[type="date"]').first();
  await deadlineInput.fill(
    new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  await page.getByPlaceholder(/nome completo para rastreio/i).fill(patientName);

  await page.getByRole('button', { name: /pr.xima etapa|pr.ximo/i }).click();
  await page.getByRole('button', { name: /finalizar e publicar os|criar os|finalizar/i }).click();

  await expect(page).toHaveURL(/\/trabalhos\/\d+$/, { timeout: 30000 });

  const urlMatch = page.url().match(/\/trabalhos\/(\d+)$/);
  const id = Number(urlMatch?.[1]);
  expect(Number.isFinite(id)).toBe(true);

  const code = (await page.locator('h1').first().textContent())?.trim() ?? '';
  expect(code).toMatch(/^OS-/i);

  return { id, code };
}

test.describe('job subtype e2e', () => {
  test('subtype urgente aparece no kanban', async ({ page }) => {
    requireManagerE2E();

    const token = suffix();
    const clientName = `Cliente Subtype U ${token}`;
    const patientName = `Paciente U ${token}`;

    await loginManager(page);
    await createClient(page, clientName);
    const job = await createJob(page, clientName, patientName);

    await page.getByRole('button', { name: /marcar urgente/i }).click();
    await expect(page.getByText(/urgente/i).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    const card = page.locator(`[data-testid="kanban-card-${job.id}"]`);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByText(/urgente/i)).toBeVisible({ timeout: 10000 });
  });

  test('subtype suspender remove do kanban ativo e reativar devolve', async ({ page }) => {
    requireManagerE2E();

    const token = suffix();
    const clientName = `Cliente Subtype S ${token}`;
    const patientName = `Paciente S ${token}`;

    await loginManager(page);
    await createClient(page, clientName);
    const job = await createJob(page, clientName, patientName);

    await page.getByRole('button', { name: /suspender/i }).click();
    await page.getByPlaceholder(/aguardando material/i).fill('Aguardando material do fornecedor');
    await page.getByRole('button', { name: /confirmar suspens.o/i }).click();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="kanban-card-${job.id}"]`)).toHaveCount(0, {
      timeout: 15000,
    });

    await page.getByRole('button', { name: /suspensas/i }).click();
    await expect(page.getByText(job.code)).toBeVisible({ timeout: 15000 });

    const suspendedRow = page.locator('div', { hasText: job.code }).first();
    await suspendedRow.getByRole('button', { name: /reativar/i }).click();

    await page.getByRole('button', { name: /ativas/i }).click();
    await expect(page.locator(`[data-testid="kanban-card-${job.id}"]`)).toBeVisible({
      timeout: 15000,
    });
  });

  test('subtype remoldagem cria nova OS filha', async ({ page }) => {
    requireManagerE2E();

    const token = suffix();
    const clientName = `Cliente Subtype R ${token}`;
    const patientName = `Paciente R ${token}`;

    await loginManager(page);
    await createClient(page, clientName);
    const original = await createJob(page, clientName, patientName);

    await page.getByRole('button', { name: /criar remoldagem/i }).click();
    await page.getByPlaceholder(/ajuste de mordida/i).fill('Refazer molde por ajuste oclusal');
    await page.getByRole('button', { name: /confirmar remoldagem/i }).click();

    await expect(page).toHaveURL(/\/trabalhos\/\d+$/, { timeout: 30000 });
    const currentUrl = page.url();
    expect(currentUrl.endsWith(`/trabalhos/${original.id}`)).toBe(false);
    await expect(page.getByText(/remoldagem/i).first()).toBeVisible({ timeout: 10000 });
  });
});
