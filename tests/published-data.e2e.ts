import { test, expect } from '@playwright/test';
import { publishedSite } from './fixtures/published-site';
test.beforeEach(async ({ page }) => {
  await page.route(
    /^https?:\/\/(?:www\.)?(?:facebook\.com|youtube\.com|google\.com)\//,
    (r) => r.fulfill({ body: '', contentType: 'text/html' }),
  );
});
test('original public pages bind API data, retain competition context and never reuse template teams', async ({
  page,
}) => {
  await page.route('**/api/v1/public/site', (r) =>
    r.fulfill({ json: publishedSite }),
  );
  for (const path of [
    '/',
    '/schedule.php',
    '/games-results.php',
    '/games-details.php',
    '/games-list.php',
    '/games-blocks.php',
    '/leaguetable.php',
    '/player-list.php',
    '/player-statics.php',
    '/player-gallery.php',
    '/player-details.php',
  ]) {
    await page.goto(path);
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.sportsState === 'ready' &&
        document.documentElement.dataset.publishedReady === 'true',
    );
    await expect(page.locator('body')).toContainText(
      path.startsWith('/player-') ? 'Panel Striker' : 'Panel Home',
    );
    if (path === '/schedule.php') {
      await expect(
        page.locator('.bigslam-sp-event-featured-title-left'),
      ).toContainText('Panel Home');
      await expect(
        page.locator('.bigslam-sp-event-featured-title-right'),
      ).toContainText('Panel Away');
    }
    await expect(page.locator('body')).not.toContainText('Liverpool');
    await expect(page.locator('body')).not.toContainText('Team 1 vs Team 2');
  }
  await page.goto('/games-list.php');
  await page
    .getByRole('link', { name: 'Panel Home vs Panel Away', exact: true })
    .click();
  await expect(page).toHaveURL(
    /games-details.php\?id=33333333.*competition=11111111/,
  );
  await expect(page.locator('.sp-event-details')).toContainText([
    'Current Cup',
  ]);
});
test('empty, failed and unpublished selections never show frozen results', async ({
  page,
}) => {
  await page.route('**/api/v1/public/site', (r) =>
    r.fulfill({
      json: { season: null, competitions: [], matches: [], players: [] },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.schedule-table').first()).toContainText(
    'No published data available.',
  );
  await expect(page.locator('body')).not.toContainText('Pigeon Forge vs');
  await page.unroute('**/api/v1/public/site');
  await page.route('**/api/v1/public/site', (r) =>
    r.fulfill({ status: 503, json: { message: 'unavailable' } }),
  );
  await page.reload();
  await expect(page.locator('.schedule-table').first()).toContainText(
    'Results temporarily unavailable.',
  );
  await page.unroute('**/api/v1/public/site');
  await page.route('**/api/v1/public/site', (r) =>
    r.fulfill({ json: publishedSite }),
  );
  await page.goto('/games-details.php?id=unpublished');
  await expect(page.locator('.sp-event-details')).toContainText([
    'No published data available.',
  ]);
});
test('calendar uses the competition timezone and navigates months; stale polls keep a labelled last update', async ({
  page,
}) => {
  let failed = false;
  const calendarData = structuredClone(publishedSite);
  calendarData.matches.push({
    ...calendarData.matches[0],
    id: 'second-match',
    home: 'Second Home',
  });
  await page.route('**/api/v1/public/site', (r) =>
    failed ? r.fulfill({ status: 503 }) : r.fulfill({ json: calendarData }),
  );
  await page.goto('/games-calendar.php');
  await expect(page.locator('.sp-calendar caption')).toHaveText(
    'February 2027',
  );
  await expect(page.locator('.sp-calendar a')).toHaveAttribute(
    'href',
    /games-list.php\?date=2027-02-01/,
  );
  await page.locator('.sp-calendar a').click();
  await expect(page).toHaveURL(/games-list.php\?date=2027-02-01/);
  await expect(page.locator('.sp-event-list tbody tr')).toHaveCount(2);
  await page.goto('/games-calendar.php');
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.locator('.sp-calendar caption')).toHaveText('March 2027');
  await page.goto('/');
  await expect(page.locator('.schedule-table').first()).toContainText(
    'Panel Home',
  );
  failed = true;
  await expect(page.locator('.schedule-table').first()).toContainText(
    'Panel Home',
  );
  await expect(
    page
      .getByText(
        'Results temporarily unavailable. Showing the last received update.',
      )
      .first(),
  ).toBeVisible({ timeout: 12000 });
  await expect(page.locator('.schedule-table').first()).toContainText(
    'Panel Home',
  );
});
test('dynamic tables keep sorting, pagination and escape names from the API', async ({
  page,
}) => {
  const data = structuredClone(publishedSite);
  data.players = Array.from({ length: 12 }, (_, i) => ({
    ...data.players[0],
    id: 'player-' + i,
    rosterId: 'roster-' + i,
    name: 'Player ' + String(11 - i).padStart(2, '0'),
  }));
  data.matches[0].home = '<img src=x onerror=alert(1)>';
  await page.route('**/api/v1/public/site', (r) => r.fulfill({ json: data }));
  await page.goto('/player-list.php');
  const table = page.locator('.sp-player-list').first();
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await page
    .locator('.dataTables_wrapper')
    .first()
    .getByRole('link', { name: 'Next', exact: true })
    .click();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await table
    .getByRole('columnheader', { name: 'Player', exact: true })
    .click();
  await expect(table.locator('tbody tr').first()).toContainText('Player 00');
  await page.goto('/games-list.php');
  await expect(page.locator('body')).toContainText(
    '<img src=x onerror=alert(1)>',
  );
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  data.matches[0].home = 'Panel Home';
  await page.goto('/');
  await expect(page.locator('.schedule-table').first()).toContainText(
    'Panel Away',
  );
  await page.screenshot({
    path: 'artifacts/published-connected-desktop.png',
    fullPage: true,
  });
});
