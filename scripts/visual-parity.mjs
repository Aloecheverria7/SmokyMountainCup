import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { fixture } from './fixtures.mjs';
if (!process.env.LEGACY_ROOT) throw Error('LEGACY_ROOT is required.');
const out = new URL('../artifacts/parity/', import.meta.url);
await mkdir(out, { recursive: true });
const sessions = new URL('../artifacts/php-sessions/', import.meta.url);
await mkdir(sessions, { recursive: true });
const php = spawn('php', ['-S', '127.0.0.1:8088', 'tools/router.php'], {
  cwd: process.env.LEGACY_ROOT,
  env: {
    ...process.env,
    APP_SESSION_PATH: sessions.pathname,
    APP_DSN: 'sqlite::memory:',
  },
  stdio: 'ignore',
});
const vite = spawn(
  'npm',
  ['run', 'dev', '-w', '@smoky/web', '--', '--port', '5178'],
  { stdio: 'ignore' },
);
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Server unavailable: ' + url);
}
let browser;
const report = [];
try {
  await Promise.all([
    ready('http://127.0.0.1:8088'),
    ready('http://127.0.0.1:5178'),
  ]);
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
    headless: true,
  });
  for (const width of [360, 390, 768, 1440])
    for (const scenario of ['empty', 'live', 'posters']) {
      const shots = [];
      for (const [label, url] of [
        ['php', 'http://127.0.0.1:8088/'],
        ['react', 'http://127.0.0.1:5178/'],
      ]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: 'reduce',
        });
        await page.clock.install({ time: new Date('2026-11-09T12:00:00Z') });
        await page.route(/\/api\/(results\.php|v1\/public\/live)/, (r) =>
          r.fulfill({ json: fixture(scenario) }),
        );
        await page.route('**/api/v1/auth/csrf', (r) =>
          r.fulfill({ json: { token: 'test' } }),
        );
        await page.goto(url);
        await page.waitForFunction(
          () =>
            document.querySelector('#cup-live-title')?.textContent !==
              'Live now' || !!document.querySelector('[data-game-id]'),
        );
        await page.locator('.cup-gallery').scrollIntoViewIfNeeded();
        await page
          .locator('.cup-gallery img')
          .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: new URL(`${width}-${scenario}-${label}.png`, out).pathname,
          fullPage: true,
        });
        shots.push(PNG.sync.read(await page.screenshot({ fullPage: true })));
        await page.close();
      }
      const [a, b] = shots;
      if (a.width !== b.width || a.height !== b.height)
        throw Error(
          `Size mismatch ${width} ${scenario}: ${a.width}x${a.height} / ${b.width}x${b.height}`,
        );
      const diff = new PNG({ width: a.width, height: a.height });
      const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
        threshold: 0.1,
      });
      await writeFile(
        new URL(`${width}-${scenario}-diff.png`, out),
        PNG.sync.write(diff),
      );
      const row = {
        width,
        scenario,
        pixels,
        total: a.width * a.height,
        ratio: pixels / (a.width * a.height),
      };
      report.push(row);
      console.log(row);
    }
  await writeFile(
    new URL('report.json', out),
    JSON.stringify(report, null, 2) + '\n',
  );
  if (report.some((r) => r.pixels > 0))
    throw Error('Visual differences detected; inspect artifacts/parity.');
} finally {
  await browser?.close();
  php.kill();
  vite.kill();
}
