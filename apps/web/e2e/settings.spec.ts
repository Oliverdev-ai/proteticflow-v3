import { test, expect } from '@playwright/test';

const managerEmail = process.env.E2E_MANAGER_EMAIL ?? '';
const managerPassword = process.env.E2E_MANAGER_PASSWORD ?? '';
const recepcaoEmail = process.env.E2E_RECEPCAO_EMAIL ?? '';
const recepcaoPassword = process.env.E2E_RECEPCAO_PASSWORD ?? '';

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('settings flow', () => {
  test('gerente edita configuracoes e persiste apos reload', async ({ page }) => {
    test.skip(!managerEmail || !managerPassword, 'Defina E2E_MANAGER_EMAIL e E2E_MANAGER_PASSWORD');

    await login(page, managerEmail, managerPassword);

    await page.goto('/configuracoes');
    await expect(page.getByText('Configuracoes')).toBeVisible();

    await page.getByRole('button', { name: 'Laboratorio' }).click();

    const uniqueName = `Lab E2E ${Date.now()}`;
    await page.getByPlaceholder('Nome').fill(uniqueName);
    await page.getByPlaceholder('Cor primaria (#RRGGBB)').fill('#123ABC');
    await page.getByPlaceholder('Cor secundaria (#RRGGBB)').fill('#334455');

    await page.getByRole('button', { name: 'Salvar identidade' }).click();
    await page.getByRole('button', { name: 'Salvar branding' }).click();

    await page.reload();
    await page.goto('/configuracoes');
    await expect(page.getByText('Configuracoes')).toBeVisible();

    await page.getByRole('button', { name: 'Planos' }).click();
    await expect(page.getByText('Plano (somente leitura nesta fase)')).toBeVisible();

    await page.getByRole('button', { name: 'Funcionarios' }).click();
    await expect(page.getByText('Funcionarios')).toBeVisible();

    await page.getByRole('button', { name: 'Autorizacoes' }).click();
    await expect(page.getByText('Autorizacoes')).toBeVisible();
  });

  test('role sem permissao nao acessa configuracoes', async ({ page }) => {
    test.skip(!recepcaoEmail || !recepcaoPassword, 'Defina E2E_RECEPCAO_EMAIL e E2E_RECEPCAO_PASSWORD');

    await login(page, recepcaoEmail, recepcaoPassword);
    await page.goto('/configuracoes');

    await expect(page.getByText('Voce nao possui permissao para acessar Configuracoes.')).toBeVisible();
  });
});
