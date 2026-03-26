import { test, expect } from '@playwright/test';

const managerEmail = process.env.E2E_MANAGER_EMAIL ?? '';
const managerPassword = process.env.E2E_MANAGER_PASSWORD ?? '';
const recepcaoEmail = process.env.E2E_RECEPCAO_EMAIL ?? '';
const recepcaoPassword = process.env.E2E_RECEPCAO_PASSWORD ?? '';

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function registerAndOnboardManager(page: import('@playwright/test').Page) {
  const suffix = Date.now().toString().slice(-8);
  const email = `e2e.manager.${suffix}@example.com`;
  const password = `Senha${suffix}A1`;

  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Nome').fill(`Gerente E2E ${suffix}`);
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Registrar' }).click();

  await page.waitForURL(/\/onboarding$/, { timeout: 30000 });
  await page.getByPlaceholder('Ex: Lab Dental Silva').fill(`Lab E2E ${suffix}`);
  await page.getByPlaceholder('Cidade').fill('Sao Paulo');
  await page.getByPlaceholder('UF').fill('SP');
  await page.getByRole('button', { name: /Criar laborat/ }).click();
  await page.getByRole('button', { name: /Acessar o painel/ }).click();
}

async function ensureManagerSession(page: import('@playwright/test').Page) {
  if (managerEmail && managerPassword) {
    await login(page, managerEmail, managerPassword);
    return;
  }
  await registerAndOnboardManager(page);
}

function profileInputs(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Salvar perfil' }).locator('xpath=preceding-sibling::div[1]//input');
}

test.describe('settings flow', () => {
  test('gerente edita configuracoes e persiste apos reload', async ({ page }) => {
    test.setTimeout(180000);
    const suffix = Date.now().toString().slice(-6);
    const profileName = `Gerente E2E ${suffix}`;
    const profilePhone = `1199${suffix}`;
    const labName = `Laboratorio E2E ${suffix}`;
    const labCity = 'Sao Paulo';
    const smtpHost = `smtp-${suffix}.e2e.local`;
    const smtpPort = '2525';
    const smtpUsername = `mailer-${suffix}`;
    const smtpFromName = `Equipe E2E ${suffix}`;
    const smtpFromEmail = `e2e+${suffix}@proteticflow.local`;

    await ensureManagerSession(page);

    await page.goto('/configuracoes', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/configuracoes$/);
    await expect(page.getByRole('heading', { name: 'Configuracoes' })).toBeVisible();

    const perfilInputs = profileInputs(page);
    await perfilInputs.nth(0).fill(profileName);
    await perfilInputs.nth(1).fill(profilePhone);
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Laboratorio' }).click();
    await page.getByPlaceholder('Nome').fill(labName);
    await page.getByPlaceholder('Cidade').fill(labCity);
    await page.getByPlaceholder('UF').fill('SP');
    await page.getByRole('button', { name: 'Salvar identidade' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('select').first().selectOption('custom_smtp');
    await page.getByPlaceholder('SMTP host').fill(smtpHost);
    await page.getByPlaceholder('SMTP port').fill(smtpPort);
    await page.getByPlaceholder('SMTP username').fill(smtpUsername);
    await page.getByPlaceholder('SMTP password').fill('senha-e2e-segura');
    await page.getByPlaceholder('Remetente nome').fill(smtpFromName);
    await page.getByPlaceholder('Remetente email').fill(smtpFromEmail);
    await page.getByRole('button', { name: 'Salvar SMTP' }).click();
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.goto('/configuracoes', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/configuracoes$/);
    await expect(page.getByRole('heading', { name: 'Configuracoes' })).toBeVisible();

    const perfilInputsReload = profileInputs(page);
    await expect(perfilInputsReload.nth(0)).toHaveValue(profileName);
    await expect(perfilInputsReload.nth(1)).toHaveValue(profilePhone);

    await page.getByRole('button', { name: 'Laboratorio' }).click();
    await expect(page.getByPlaceholder('Nome')).toHaveValue(labName);
    await expect(page.getByPlaceholder('Cidade')).toHaveValue(labCity);
    await expect(page.getByPlaceholder('UF')).toHaveValue('SP');
    await expect(page.locator('select').first()).toHaveValue('custom_smtp');
    await expect(page.getByPlaceholder('SMTP host')).toHaveValue(smtpHost);
    await expect(page.getByPlaceholder('SMTP port')).toHaveValue(smtpPort);
    await expect(page.getByPlaceholder('SMTP username')).toHaveValue(smtpUsername);
    await expect(page.getByPlaceholder('Remetente nome')).toHaveValue(smtpFromName);
    await expect(page.getByPlaceholder('Remetente email')).toHaveValue(smtpFromEmail);
  });

  test('role sem permissao nao acessa configuracoes', async ({ page }) => {
    test.skip(!recepcaoEmail || !recepcaoPassword, 'Defina E2E_RECEPCAO_EMAIL e E2E_RECEPCAO_PASSWORD');

    await login(page, recepcaoEmail, recepcaoPassword);
    await page.goto('/configuracoes');

    await expect(page.getByText('Voce nao possui permissao para acessar Configuracoes.')).toBeVisible();
  });
});
