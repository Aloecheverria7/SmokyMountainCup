import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
test.skip(
  process.env.SMC_ADMIN_TEST !== '1',
  'Run npm run test:admin with its isolated API.',
);
async function login(page: Page) {
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
async function api(page: Page, path: string, method = 'GET', body?: any) {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === 'cup_csrf')?.value;
  const r = await page.request.fetch('/api/v1/' + path, {
    method,
    headers: {
      Origin: 'http://127.0.0.1:5173',
      'X-CSRF-Token': csrf ?? '',
      'Idempotency-Key': randomUUID(),
    },
    data: body,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
test('organizer prepares players, courts and a draw; a lost goal response is recoverable without duplication', async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  const season = (
    await api(page, 'seasons', 'POST', {
      name: 'Sports UI edition',
      timezone: 'America/New_York',
    })
  ).data;
  await api(page, `seasons/${season.id}/activate`, 'POST', {
    expectedVersion: 0,
  });
  const c = (await api(page, `seasons/${season.id}/competitions`)).data.find(
    (c: any) => c.slug === 'infantil',
  );
  await api(page, `competitions/${c.id}`, 'PATCH', {
    expectedVersion: 0,
    duration: 45,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    groupCapacity: 4,
    qualifiers: 1,
    rulesConfirmed: true,
  });
  for (let i = 1; i <= 4; i++) {
    const t = (await api(page, 'teams', 'POST', { name: 'UI Team ' + i })).data;
    await api(page, `competitions/${c.id}/entries`, 'POST', { teamId: t.id });
  }
  await page.getByRole('button', { name: 'Jugadores', exact: true }).click();
  const createPlayer = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Crear jugador', exact: true }),
  });
  await createPlayer
    .getByLabel('Nombre del jugador', { exact: true })
    .fill('UI Striker');
  await createPlayer
    .getByLabel('Fecha de nacimiento (opcional)', { exact: true })
    .fill('2020-01-01');
  await createPlayer
    .getByLabel('Contacto privado (opcional)', { exact: true })
    .fill('PRIVATE UI CONTACT');
  await createPlayer
    .getByRole('button', { name: 'Guardar', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'UI Striker', exact: true }),
  ).toBeVisible();
  const selector = page.getByRole('combobox', {
    name: 'Equipo inscrito',
    exact: true,
  });
  const selectedEntry = await selector
    .locator('option')
    .filter({ hasText: 'UI Team 1' })
    .getAttribute('value');
  await selector.selectOption(selectedEntry!);
  const playerSelect = page.getByRole('combobox', {
    name: 'Jugador',
    exact: true,
  });
  await playerSelect.selectOption(
    (await playerSelect
      .locator('option')
      .filter({ hasText: 'UI Striker' })
      .getAttribute('value'))!,
  );
  await page.getByLabel('Dorsal', { exact: true }).fill('9');
  await page
    .getByRole('button', { name: 'Añadir a plantilla', exact: true })
    .click();
  await expect(page.getByText('#9 UI Striker', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Sedes y canchas', exact: true })
    .click();
  await page.getByLabel('Nombre de la sede', { exact: true }).fill('UI Venue');
  await page.getByRole('button', { name: 'Crear sede', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'UI Venue', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Sede', exact: true })
    .selectOption({ label: 'UI Venue' });
  await page
    .getByLabel('Nombre de la cancha', { exact: true })
    .fill('UI Field');
  await page.getByRole('button', { name: 'Crear cancha', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'UI Field · UI Venue', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Organización', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Temporada', exact: true })
    .selectOption({ label: 'Sports UI edition' });
  await page
    .getByRole('combobox', { name: 'Competición', exact: true })
    .selectOption({ label: 'Infantil' });
  await page
    .getByRole('button', { name: 'Generar vista previa', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Vista previa', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Publicar este sorteo', exact: true })
    .click();
  await expect(
    page.getByText('Sorteo publicado.', { exact: false }),
  ).toBeVisible();
  const list = (await api(page, `matches?competitionId=${c.id}&limit=100`))
    .data;
  const first = list.find(
    (m: any) =>
      m.homeEntryId === selectedEntry || m.awayEntryId === selectedEntry,
  );
  expect(first).toBeTruthy();
  await page.getByRole('button', { name: 'Partidos', exact: true }).click();
  await page
    .getByRole('button', {
      name: `Abrir ${first.home} vs ${first.away}`,
      exact: true,
    })
    .click();
  await page.getByText('Horario, cancha y anotador', { exact: true }).click();
  await page
    .getByLabel('Fecha y hora · America/New_York', { exact: true })
    .fill('2027-02-01T10:00');
  await page
    .getByRole('combobox', { name: 'Cancha', exact: true })
    .selectOption({ label: 'UI Venue · UI Field' });
  await page
    .getByRole('button', { name: 'Guardar horario', exact: true })
    .click();
  await expect(page.locator('.smc-match-editor')).toContainText('UI Field');
  await page
    .getByRole('combobox', { name: 'Nuevo estado', exact: true })
    .selectOption('live');
  await page
    .getByRole('button', { name: 'Cambiar estado', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Registrar gol o autogol', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Equipo del autor', exact: true })
    .selectOption(selectedEntry!);
  await page.getByLabel('Minuto', { exact: true }).fill('12');
  const keys: string[] = [];
  await page.route(`**/api/v1/matches/${first.id}/events`, async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    if (keys.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page
    .getByRole('button', { name: 'Registrar gol', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Reintentar operación pendiente',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Partidos', exact: true }).click();
  await page
    .getByRole('button', {
      name: `Abrir ${first.home} vs ${first.away}`,
      exact: true,
    })
    .click();
  const retryResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/matches/${first.id}/events`) &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', {
      name: 'Reintentar operación pendiente',
      exact: true,
    })
    .click();
  expect((await retryResponse).status()).toBe(200);
  await expect(
    page.getByRole('button', {
      name: 'Reintentar operación pendiente',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  const detail = await api(page, `matches/${first.id}`);
  expect(detail.events).toHaveLength(1);
  expect(detail.data.home_score + detail.data.away_score).toBe(1);
  const publicPage = await page.context().newPage();
  await publicPage.route(
    /^https?:\/\/(?:www\.)?(?:facebook\.com|youtube\.com|google\.com)\//,
    (r) => r.fulfill({ body: '', contentType: 'text/html' }),
  );
  await publicPage.goto('/');
  await expect(publicPage.locator('.schedule-table')).toContainText([
    'UI Team',
    'UI Team',
  ]);
  await expect(publicPage.locator('.schedule-table').first()).toContainText(
    '1',
  );
  await publicPage.goto(
    `/games-results.php?id=${first.id}&competition=${c.id}`,
  );
  await expect(
    publicPage.locator('.sp-event-results tbody .data-goals'),
  ).toHaveText([
    String(detail.data.home_score),
    String(detail.data.away_score),
  ]);
  // A write through the authenticated admin API must reach the original public template without a reload.
  const changed = await api(
    page,
    `matches/${first.id}/events/${detail.events[0].id}/void`,
    'POST',
    {
      expectedVersion: detail.data.version,
      reason: 'Public live integration correction',
    },
  );
  await expect(
    publicPage.locator('.sp-event-results tbody .data-goals'),
  ).toHaveText(['0', '0'], { timeout: 10000 });
  await publicPage.goto(`/leaguetable.php?competition=${c.id}`);
  await expect(publicPage.locator('.sp-league-table')).toHaveCount(2);
  await publicPage.goto(`/player-list.php?competition=${c.id}`);
  await expect(publicPage.locator('.sp-player-list').first()).toContainText([
    'UI Striker',
  ]);
  await expect(publicPage.locator('body')).not.toContainText(
    'PRIVATE UI CONTACT',
  );
  await publicPage.setViewportSize({ width: 1440, height: 1000 });
  await publicPage.goto('/');
  await expect(publicPage.locator('.schedule-table').first()).toContainText(
    'UI Team',
  );
  await publicPage.screenshot({
    path: 'artifacts/published-real-api.png',
    fullPage: true,
  });
  await publicPage.close();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({
    path: 'artifacts/scoring-desktop.png',
    fullPage: true,
  });
});
test('public tournament shows published groups, fixtures, bracket and scorers', async ({
  page,
}) => {
  await page.goto('/tournament.php');
  await expect(
    page.getByRole('heading', { name: 'Tournament center', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Competition views' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Fixtures & results', exact: true })
    .last()
    .click();
  await expect(page.locator('.cup-match-grid article').first()).toBeVisible();
  await page.locator('.cup-match-grid article a').first().click();
  await expect(
    page.getByRole('heading', { name: 'Match events', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/public-match.png', fullPage: true });
});
