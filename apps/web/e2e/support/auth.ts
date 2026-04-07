import { test, type Page } from '@playwright/test';

export const managerEmail = process.env.E2E_MANAGER_EMAIL ?? '';
export const managerPassword = process.env.E2E_MANAGER_PASSWORD ?? '';
export const recepcaoEmail = process.env.E2E_RECEPCAO_EMAIL ?? '';
export const recepcaoPassword = process.env.E2E_RECEPCAO_PASSWORD ?? '';

export const hasManagerE2E = Boolean(managerEmail && managerPassword);
export const hasRecepcaoE2E = Boolean(recepcaoEmail && recepcaoPassword);

const MISSING_MANAGER_ENV_MESSAGE =
  'Defina E2E_MANAGER_EMAIL e E2E_MANAGER_PASSWORD para rodar este E2E.';

export function requireManagerE2E() {
  test.skip(!hasManagerE2E, MISSING_MANAGER_ENV_MESSAGE);
}

export async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await page.waitForURL(/^\/$/, { timeout: 30000 });
}

export async function loginManager(page: Page) {
  requireManagerE2E();
  await loginWithCredentials(page, managerEmail, managerPassword);
}
