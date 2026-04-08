import { expect, test, type Page } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

function suffix() {
  return Date.now().toString().slice(-7);
}

async function createSupplier(page: Page, supplierName: string) {
  await page.goto('/estoque/fornecedores', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /novo fornecedor/i }).click();
  await page.getByPlaceholder(/labdental furnitures/i).fill(supplierName);
  await page.getByRole('button', { name: /salvar fornecedor/i }).click();
  await expect(page.getByText(supplierName)).toBeVisible({ timeout: 15000 });
}

async function createMaterial(page: Page, materialName: string, materialCode: string) {
  await page.goto('/estoque/materiais', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /registrar material/i }).click();
  await page.getByPlaceholder(/resina z350/i).fill(materialName);
  await page.getByPlaceholder(/00x-aaa-99/i).fill(materialCode);
  await page.getByRole('button', { name: /confirmar cadastro/i }).click();
  await expect(page.getByText(materialName)).toBeVisible({ timeout: 15000 });
}

async function createPurchase(
  page: Page,
  supplierName: string,
  materialName: string,
): Promise<{ id: number; code: string }> {
  await page.goto('/compras/novo', { waitUntil: 'domcontentloaded' });

  await page.locator('#supplier-search').fill(supplierName);
  await page
    .getByRole('button', { name: new RegExp(supplierName, 'i') })
    .first()
    .click();
  await expect(page.getByText(/fornecedor selecionado/i)).toBeVisible({ timeout: 10000 });

  await page.locator('#material-search').fill(materialName);
  await page
    .getByRole('button', { name: new RegExp(materialName, 'i') })
    .first()
    .click();

  await page.locator('#qty-0').fill('2');
  await page.locator('#price-0').fill('12,50');

  await page.locator('#btn-salvar-compra').click();
  await expect(page).toHaveURL(/\/compras\/\d+$/, { timeout: 30000 });

  const idMatch = page.url().match(/\/compras\/(\d+)$/);
  const id = Number(idMatch?.[1] ?? NaN);
  expect(Number.isFinite(id)).toBe(true);

  const code = (await page.locator('h1').first().textContent())?.trim() ?? '';
  expect(code).toMatch(/^CMP-/i);

  return { id, code };
}

test.describe('purchase flow e2e', () => {
  test('cria compra, confirma e recebe com lancamento em contas a pagar', async ({ page }) => {
    requireManagerE2E();

    const token = suffix();
    const supplierName = `Fornecedor E2E ${token}`;
    const materialName = `Material Compra ${token}`;
    const materialCode = `CMP-${token}`;

    await loginManager(page);
    await createSupplier(page, supplierName);
    await createMaterial(page, materialName, materialCode);

    await createPurchase(page, supplierName, materialName);

    await page.locator('#btn-confirmar').click();
    await expect(page.getByText(/confirmada/i).first()).toBeVisible({ timeout: 10000 });

    await page.locator('#btn-receber').click();
    const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.locator('#receive-due-date').fill(dueDate);
    await page.locator('#btn-confirm-receive').click();

    await expect(page.getByText(/recebida/i).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('link', { name: /ver contas a pagar/i }).click();
    await expect(page).toHaveURL(/\/financeiro\/contas-pagar$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /contas a pagar/i })).toBeVisible({
      timeout: 15000,
    });
  });
});
