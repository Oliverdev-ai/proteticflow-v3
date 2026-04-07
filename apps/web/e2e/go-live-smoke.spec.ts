import { expect, test } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

test.describe('go live smoke e2e', () => {
  test('manager percorre rotas criticas do produto', async ({ page }) => {
    requireManagerE2E();
    await loginManager(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /dashboard/i }).or(
        page.getByText(/n.o foi poss.vel carregar o dashboard/i),
      ),
    ).toBeVisible({ timeout: 20000 });

    await page.goto('/trabalhos/novo', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /iniciando os/i })).toBeVisible({ timeout: 15000 });

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /fluxo de produ/i })).toBeVisible({ timeout: 15000 });

    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /flow ia/i })).toBeVisible({ timeout: 15000 });

    await page.goto('/estoque', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /estoque/i })).toBeVisible({ timeout: 15000 });

    await page.goto('/compras', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /compras/i })).toBeVisible({ timeout: 15000 });
  });

  test('flow ia executa quick action de leitura no smoke', async ({ page }) => {
    requireManagerE2E();
    await loginManager(page);

    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /trabalhos pendentes/i }).click();
    await expect(page.getByText(/Comando jobs\.listPending executado com sucesso/i)).toBeVisible({
      timeout: 20000,
    });
  });
});
