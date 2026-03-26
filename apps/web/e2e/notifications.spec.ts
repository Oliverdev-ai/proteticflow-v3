import { test, expect } from '@playwright/test';

const managerEmail = process.env.E2E_MANAGER_EMAIL ?? '';
const managerPassword = process.env.E2E_MANAGER_PASSWORD ?? '';

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('notifications flow', () => {
  test('preferencias, permissao push e leitura no sino', async ({ page, context }) => {
    test.skip(!managerEmail || !managerPassword, 'Defina E2E_MANAGER_EMAIL e E2E_MANAGER_PASSWORD');

    await context.grantPermissions(['notifications']);
    await login(page, managerEmail, managerPassword);

    await page.goto('/configuracoes');
    await page.getByRole('button', { name: 'Notificacoes' }).click();

    const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
    const before = await firstCheckbox.isChecked();
    await firstCheckbox.click();
    if (before) {
      await expect(firstCheckbox).not.toBeChecked();
    } else {
      await expect(firstCheckbox).toBeChecked();
    }

    await page.getByRole('button', { name: 'Enviar Notificacao de Teste' }).click();

    await page.goto('/');
    await page.getByRole('button', { name: 'Notificacoes' }).click();
    await expect(page.getByText('Teste de notificacao')).toBeVisible();

    const markAllBtn = page.getByRole('button', { name: 'Marcar todas como lidas' });
    await markAllBtn.click();

    await page.goto('/configuracoes');
    await page.getByRole('button', { name: 'Notificacoes' }).click();
    await expect(page.getByText('Preferencias de notificacoes por canal')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Notificacoes' }).click();
    if (before) {
      await expect(firstCheckbox).not.toBeChecked();
    } else {
      await expect(firstCheckbox).toBeChecked();
    }

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Habilitar Push (PWA)' }).click();

    const swActivated = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return false;
      const ready = await navigator.serviceWorker.ready;
      return Boolean(ready.active);
    });
    expect(swActivated).toBeTruthy();

    const subscriptionBeforeClose = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      return Boolean(sub?.endpoint);
    });
    expect(subscriptionBeforeClose).toBeTruthy();

    await page.close();
    const reopened = await context.newPage();
    await reopened.goto('/configuracoes');
    await reopened.getByRole('button', { name: 'Notificacoes' }).click();

    const subscriptionAfterReopen = await reopened.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      return Boolean(sub?.endpoint);
    });
    expect(subscriptionAfterReopen).toBeTruthy();
  });
});
