import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
test.skip(
  process.env.SMC_ADMIN_TEST !== '1',
  'Run npm run test:admin to start an isolated MariaDB and API.',
);
async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/');
  await page
    .getByLabel('Correo', { exact: true })
    .fill(process.env.SMC_TEST_EMAIL!);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill(process.env.SMC_TEST_PASSWORD!);
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Temporadas', exact: true }),
  ).toBeVisible();
}
test('administrator creates a season, four competitions, a team and an entry', async ({
  page,
}) => {
  await login(page);
  await page.getByLabel('Nombre', { exact: true }).fill('Edición E2E');
  await page
    .getByRole('button', { name: 'Crear temporada', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Configurar Edición E2E', exact: true })
    .click();
  const tabs = page.getByRole('navigation', {
    name: 'Competiciones',
    exact: true,
  });
  await expect(tabs.getByRole('button')).toHaveCount(4);
  await tabs
    .getByRole('button', { name: 'Infantil · A / B', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Infantil — grupos A y B' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Equipos', exact: true }).click();
  await page
    .getByLabel('Nombre del equipo', { exact: true })
    .fill('Equipo E2E');
  await page.getByRole('button', { name: 'Crear equipo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Equipo E2E', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Temporadas', exact: true }).click();
  await page
    .getByRole('button', { name: 'Configurar Edición E2E', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Competiciones' })
    .getByRole('button', { name: 'Infantil · A / B', exact: true })
    .click();
  const option = page
    .locator('select[name="teamId"] option')
    .filter({ hasText: 'Equipo E2E' });
  const teamId = await option.getAttribute('value');
  await page
    .getByRole('combobox', { name: 'Equipo', exact: true })
    .selectOption(teamId!);
  await page
    .getByRole('button', { name: 'Inscribir equipo', exact: true })
    .click();
  await expect(
    page.locator('li').filter({ hasText: 'Equipo E2E' }),
  ).toBeVisible();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({
    path: 'artifacts/admin-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Cerrar sesión', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Acceso del personal' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Acceso del personal' }),
  ).toBeVisible();
});
test('staff interface is usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
  await expect(page.getByLabel('Contraseña actual')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/admin-mobile.png', fullPage: true });
});
