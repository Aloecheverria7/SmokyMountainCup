import { test, expect } from '@playwright/test';
test.skip(
  process.env.SMC_IMPORT_TEST !== '1',
  'Run the isolated import suite with --browser.',
);
test('administrator publishes and hides original fixtures without redrawing groups', async ({
  page,
}) => {
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
  await page.getByRole('button', { name: 'Organización', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Temporada', exact: true })
    .selectOption(process.env.SMC_IMPORT_SEASON!);
  await page
    .getByRole('combobox', { name: 'Competición', exact: true })
    .selectOption(process.env.SMC_IMPORT_COMPETITION!);
  await expect(
    page.getByText('Datos importados sin publicar.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Preparar sorteo', { exact: true })).toHaveCount(
    0,
  );
  const publication = page.locator('form').filter({
    has: page.getByRole('button', {
      name: /^(Publicar|Ocultar) datos importados$/,
    }),
  });
  await publication
    .getByLabel('Motivo', { exact: true })
    .fill('Publicación revisada desde el panel de administración.');
  await page
    .getByRole('button', { name: 'Publicar datos importados', exact: true })
    .click();
  await expect(
    page.getByText('Datos importados publicados.', { exact: false }),
  ).toBeVisible();
  const r = await page.request.get(
    `/api/v1/public/competitions/${process.env.SMC_IMPORT_COMPETITION}/matches`,
  );
  expect(r.ok()).toBeTruthy();
  const json = await r.json();
  expect(json.data.length).toBe(Number(process.env.SMC_IMPORT_FIXTURE_COUNT));
  await publication
    .getByLabel('Motivo', { exact: true })
    .fill('Retiro temporal conservando todos los datos originales.');
  await page
    .getByRole('button', { name: 'Ocultar datos importados', exact: true })
    .click();
  await expect(
    page.getByText('Datos importados sin publicar.', { exact: false }),
  ).toBeVisible();
  const hidden = await page.request.get(
    `/api/v1/public/competitions/${process.env.SMC_IMPORT_COMPETITION}/matches`,
  );
  expect(hidden.status()).toBe(404);
});
