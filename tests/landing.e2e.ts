import { test, expect } from '@playwright/test';
import { publishedSite } from './fixtures/published-site';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/public/site', (r) =>
    r.fulfill({ json: publishedSite }),
  );
  await page.route('**/api/v1/public/matches/*', (r) =>
    r.fulfill({
      json: {
        data: publishedSite.matches[0],
        events: [
          {
            id: 'goal',
            entryId: 'entry-home',
            player: 'Panel Striker',
            number: 9,
            kind: 'goal',
          },
        ],
      },
    }),
  );
  await page.route(
    /^https?:\/\/(?:www\.)?(?:facebook\.com|youtube\.com|google\.com)\//,
    (route) => route.fulfill({ body: '', contentType: 'text/html' }),
  );
});
test('published landing keeps original hero, schedule, forms and slider interactions', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(
    () => document.documentElement.dataset.publishedReady === 'true',
  );
  await expect(page.locator('#rev_slider_1_1')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Latest Games', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: /Soccer Tournament Schedule - Smoky Mountain Cup/i,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.imagenes-tablas img')).toHaveCount(3);
  await expect(page.locator('.cup-hero')).toHaveCount(0);
  const slides = await page.locator('rs-slide').count();
  expect(slides).toBe(3);
  await expect(page.locator('rs-slide.active-rs-slide')).toBeVisible();
  await page.waitForTimeout(1200);
  const activeIndex = () =>
    page
      .locator('rs-slide')
      .evaluateAll((nodes) =>
        nodes.findIndex((node) => node.classList.contains('active-rs-slide')),
      );
  const before = await activeIndex();
  await page.locator('#rev_slider_1_1').hover();
  await page.locator('#rev_slider_1_1 .tp-rightarrow').click();
  await expect.poll(activeIndex).toBe((before + 1) % slides);
  await expect(page.locator('form[action="inscriptionmail.php"]')).toHaveCount(
    1,
  );
});
test('mobile menu preserves original navigation and overlay toggle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(
    () => document.documentElement.dataset.publishedReady === 'true',
  );
  const button = page.locator('.bigslam-mobile-menu-button');
  await button.click();
  await expect(page.locator('.bigslam-overlay-menu-content')).toBeVisible();
  await expect(
    page
      .locator('.bigslam-overlay-menu-content')
      .getByRole('link', { name: 'About', exact: true }),
  ).toBeVisible();
  await page.locator('.bigslam-overlay-menu-close').click();
  await expect(page.locator('.bigslam-overlay-menu-content')).not.toBeVisible();
});
test('original form fields submit through the API and only navigate to success after acceptance', async ({
  page,
}) => {
  let payload: any;
  await page.route('**/api/v1/auth/csrf', (r) =>
    r.fulfill({ json: { token: 'test-csrf' } }),
  );
  await page.route('**/api/v1/public/inquiries', (r) => {
    payload = r.request().postDataJSON();
    return r.fulfill({ json: { ok: true } });
  });
  await page.goto('/');
  await page.waitForFunction(
    () => document.documentElement.dataset.publishedReady === 'true',
  );
  const form = page.locator('form[action="inscriptionmail.php"]');
  for (const [name, value] of Object.entries({
    team_name: 'Test team',
    owner: 'Test owner',
    email: 'test@example.test',
    phone: '5551234567',
    players_to_enroll: 'Infantil A',
  }))
    await form.locator(`[name="${name}"]`).fill(value);
  await form.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page).toHaveURL(/thank-you.php$/);
  expect(payload).toEqual({
    kind: 'registration',
    team_name: 'Test team',
    owner: 'Test owner',
    email: 'test@example.test',
    phone: '5551234567',
    players_to_enroll: 'Infantil A',
  });
});
test('SMTP unavailable preserves the original error-page navigation', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/csrf', (r) =>
    r.fulfill({ json: { token: 'test-csrf' } }),
  );
  await page.route('**/api/v1/public/inquiries', (r) =>
    r.fulfill({ status: 503, json: { message: 'SMTP unavailable' } }),
  );
  await page.goto('/contact.php');
  await page.waitForFunction(
    () => document.documentElement.dataset.publishedReady === 'true',
  );
  const form = page.locator('form[action="mail.php"]');
  await form.locator('[name="name"]').fill('Test');
  await form.locator('[name="email"]').fill('test@example.test');
  await form.locator('[name="message"]').fill('Test only');
  await form.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page).toHaveURL(/sorry.php$/);
});

test('gallery zoom and homepage image lightbox preserve the published behavior', async ({
  page,
}) => {
  await page.goto('/gallery.php');
  await page.waitForFunction(
    () => document.documentElement.dataset.publishedReady === 'true',
  );
  const card = page.locator('.gdlr-core-zoom-on-hover').first();
  const image = card.locator('img');
  const before = await image.evaluate((e) => getComputedStyle(e).transform);
  await card.hover();
  await expect
    .poll(() => image.evaluate((e) => getComputedStyle(e).transform))
    .not.toBe(before);
  // Published gallery film icons have no href; do not invent a video destination.
  await expect(page.locator('a.gdlr-core-ilightbox[href]')).toHaveCount(0);
  await page.goto('/');
  await page.waitForFunction(
    () => document.documentElement.dataset.publishedReady === 'true',
  );
  await page
    .locator('a[href="upload/shutterstock_433241116-550x500.jpg"]')
    .click();
  await expect(page.locator('.ilightbox-holder').first()).toBeVisible();
  await page.locator('.ilightbox-close').click();
  await expect(page.locator('.ilightbox-holder')).toHaveCount(0);
});
test('Sportspress inline important icon colors survive rendering in React', async ({
  page,
}) => {
  await page.goto('/games-boxScores.php');
  await page.waitForFunction(
    () => document.documentElement.dataset.publishedReady === 'true',
  );
  await expect(page.locator('.sp-icon-soccerball').first()).toHaveCSS(
    'color',
    'rgb(34, 34, 34)',
  );
});
test('home back-to-top uses the original smooth-scroll behavior', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(
    () => document.documentElement.dataset.publishedReady === 'true',
  );
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeGreaterThan(1000);
  await page.locator('#bigslam-footer-back-to-top-button').click();
  await expect
    .poll(() => page.evaluate(() => scrollY), { timeout: 5000 })
    .toBe(0);
});
