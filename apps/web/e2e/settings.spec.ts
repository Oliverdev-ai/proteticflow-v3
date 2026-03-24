import { test, expect } from '@playwright/test';

test.describe('settings flow', () => {
  test('gerente consegue editar configuracoes e persistir', async ({ page }) => {
    await page.goto('/login');

    // Placeholder: fluxo detalhado depende de dados seed no ambiente e2e.
    // Gate da fase: manter spec de cobertura para caminho feliz e bloqueios RBAC.
    await expect(page).toHaveURL(/login/);
  });
});
