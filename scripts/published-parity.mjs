import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { createHash, randomBytes } from 'node:crypto';
import pixelmatch from 'pixelmatch';
const captured = resolve(
    process.env.PUBLISHED_REFERENCE_DIR ||
      'tests/fixtures/published-2026-11-14',
  ),
  assets = resolve('apps/web/public');
const output = resolve(
  process.env.PARITY_OUTPUT_DIR || 'artifacts/published-parity',
);
const referencePort = Number(process.env.PUBLISHED_REFERENCE_PORT || 5188);
const siteFixture = JSON.parse(
  await readFile('tests/fixtures/published-site.json', 'utf8'),
);
const referenceBase = `http://127.0.0.1:${referencePort}`;
await mkdir(output, { recursive: true });
const mime = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.html': 'text/html',
};
const resourceManifest = JSON.parse(
  await readFile('docs/published-reference-assets.json', 'utf8'),
);
const referenceResources = new Map(
  resourceManifest.filter((r) => !r.error).map((r) => [decodeURI(r.path), r]),
);
async function originalAsset(path) {
  if (path === '/images/player-placeholder.png') path = '/upload/logo.png';
  const decoded = decodeURI(path),
    metadata = referenceResources.get(decoded);
  let bytes;
  try {
    bytes = await readFile(
      resolve('tests/fixtures/published-original-assets', '.' + decoded),
    );
  } catch {
    bytes = await readFile(resolve(assets, '.' + decoded));
  }
  if (
    !metadata ||
    createHash('sha256').update(bytes).digest('hex') !== metadata.sha256
  )
    throw Error(
      'Original asset does not match its captured SHA-256: ' + decoded,
    );
  return bytes;
}
const original = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    let file;
    if (path === '/' || path === '/index.php')
      file = resolve(captured, 'index.html');
    else if (path.endsWith('.php'))
      file = resolve(captured, path.slice(1) + '.html');
    else file = resolve(assets, '.' + path);
    if (!file.startsWith(captured + '/') && !file.startsWith(assets + '/'))
      throw Error();
    const bytes = file.startsWith(captured + '/')
      ? await readFile(file)
      : await originalAsset(path);
    res.setHeader(
      'Content-Type',
      mime[extname(file)] || 'application/octet-stream',
    );
    res.end(bytes);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});
await new Promise((r) => original.listen(referencePort, '127.0.0.1', r));
const appBase = process.env.PUBLISHED_APP_URL || 'http://127.0.0.1:5178';
const appServer = process.env.PUBLISHED_APP_URL
  ? null
  : spawn(process.execPath, ['apps/api/dist/main.js'], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '5178',
        LISTEN_HOST: '127.0.0.1',
        SERVE_WEB: '1',
        TRUST_PROXY_HOPS: '0',
        APP_ORIGIN: appBase,
        CSRF_SECRET: randomBytes(32).toString('hex'),
        APP_DB_NAME: '',
        LEGACY_DB_NAME: '',
        PUBLIC_DATA_SOURCE: 'legacy',
        SMTP_HOST: '',
      },
      stdio: 'ignore',
    });
let browser;
const results =
  process.env.PARITY_MERGE === '1'
    ? JSON.parse(await readFile(resolve(output, 'report.json'), 'utf8'))
    : [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(appBase + '/')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
    headless: true,
  });
  const manifest = JSON.parse(
    await readFile('docs/published-reference-assets.json', 'utf8'),
  );
  const mapping = new Map(
    manifest.filter((r) => !r.error).map((r) => [r.url, r]),
  );
  const files = (await readdir(captured)).filter((f) => f.endsWith('.html'));
  const subset = process.env.PARITY_PAGES?.split(',');
  const widths = (process.env.PARITY_WIDTHS || '360,390,768,1440')
    .split(',')
    .map(Number);
  for (const width of widths)
    for (const file of files) {
      if (subset && !subset.includes(file)) continue;
      const path = file === 'index.html' ? '/' : '/' + file.slice(0, -5);
      let firstDifferentPixels = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const shots = [];
        let bindings = [];
        const structure = [];
        for (const [label, base] of [
          ['react', appBase],
          ['reference', referenceBase],
        ]) {
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            reducedMotion: 'no-preference',
          });
          await context.route('**/*', async (route) => {
            const u = route.request().url();
            if (u.endsWith('/api/v1/public/site'))
              return route.fulfill({ json: siteFixture });
            if (u.includes('/api/v1/public/matches/'))
              return route.fulfill({
                json: {
                  data: siteFixture.matches[0],
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
              });
            if (u.startsWith(base)) return route.continue();
            const item = mapping.get(u);
            if (item) {
              const b =
                label === 'reference'
                  ? await originalAsset(item.path)
                  : await readFile(resolve(assets, '.' + decodeURI(item.path)));
              return route.fulfill({ body: b, contentType: item.type });
            }
            if (route.request().resourceType() === 'document')
              return route.fulfill({ body: '', contentType: 'text/html' });
            return route.abort();
          });
          const page = await context.newPage();
          await page.goto(base + path, { waitUntil: 'load' });
          if (label === 'react')
            await page.waitForFunction(
              () => document.documentElement.dataset.publishedReady === 'true',
            );
          if (label === 'react') {
            await page.waitForFunction(
              () => document.documentElement.dataset.sportsState === 'ready',
            );
            bindings = await page
              .locator('[data-smc-selector]')
              .evaluateAll((nodes) => {
                const tree = (n) => ({
                  type: n.nodeType,
                  name: n.nodeName,
                  value: n.nodeValue,
                  attrs:
                    n.nodeType === 1
                      ? [...n.attributes].map((a) => [a.name, a.value])
                      : [],
                  children: [...n.childNodes].map(tree),
                });
                return nodes.map((n) => ({
                  selector: n.dataset.smcSelector,
                  index: Number(n.dataset.smcIndex),
                  tree: tree(n),
                }));
              });
          } else {
            // Compare original independently pinned CSS/theme containers under the SAME public data projection.
            // API correctness and binding correctness are tested separately against real admin writes.
            await page.evaluate((bindings) => {
              const targets = bindings.map((b) => ({
                binding: b,
                node: document.querySelectorAll(b.selector)[b.index],
              }));
              for (const { binding, node } of targets) {
                if (!node)
                  throw Error('Missing reference binding: ' + binding.selector);
                const build = (n) => {
                  const el =
                    n.type === 3
                      ? document.createTextNode(n.value)
                      : n.type === 8
                        ? document.createComment(n.value)
                        : document.createElement(n.name.toLowerCase());
                  for (const [k, v] of n.attrs) el.setAttribute(k, v);
                  for (const child of n.children) el.appendChild(build(child));
                  return el;
                };
                const bound = build(binding.tree);
                const target =
                  node.tagName === 'TABLE'
                    ? node.closest('.sp-scrollable-table-wrapper') ||
                      node.closest('.dataTables_wrapper') ||
                      node
                    : node;
                target.replaceWith(bound);
              }
              window.dispatchEvent(new Event('resize'));
            }, bindings);
          }
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(500);
          await page.evaluate(() => {
            if (window.revapi1?.revshowslide) {
              window.revapi1.revshowslide(1);
              window.revapi1.revpause();
            }
          });
          await page.waitForTimeout(1600);
          // Trigger the same viewport-entry effects in both pages, without disabling motion globally.
          const height = await page.evaluate(
            () => document.documentElement.scrollHeight,
          );
          for (let y = 0; y < height; y += 900) {
            await page.evaluate((y) => scrollTo(0, y), y);
            await page.waitForTimeout(50);
          }
          await page.evaluate(() => scrollTo(0, 0));
          await page.waitForTimeout(1500);
          await page.waitForFunction(
            () => !window.jQuery || window.jQuery(':animated').length === 0,
            {},
            { timeout: 10000 },
          );
          structure.push(
            await page.evaluate(() => ({
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
              text: document.body.innerText.replace(/\s+/g, ' ').trim(),
              headings: [...document.querySelectorAll('h1,h2,h3')].map((e) =>
                e.textContent.trim(),
              ),
              geometry: [
                ...document.querySelectorAll(
                  '[data-smc-selector] th,[data-smc-selector] td,[data-smc-selector] h3,[data-smc-selector] h4,.bigslam-mobile-logo img,.bigslam-logo img',
                ),
              ].map((e) => {
                const r = e.getBoundingClientRect();
                const s = getComputedStyle(e);
                return [
                  Math.round(r.x * 100) / 100,
                  Math.round(r.y * 100) / 100,
                  Math.round(r.width * 100) / 100,
                  Math.round(r.height * 100) / 100,
                  s.fontFamily,
                  s.fontSize,
                  s.fontWeight,
                  s.lineHeight,
                  s.color,
                ];
              }),
              images: [...document.images].map((i) => ({
                src: (i.getAttribute('src') || '').replace(location.origin, ''),
                width: i.naturalWidth,
                height: i.naturalHeight,
              })),
            })),
          );
          const shot = await page.screenshot({
            fullPage: true,
            animations: 'disabled',
            mask: [page.locator('iframe')],
            maskColor: '#eee',
          });
          await writeFile(
            resolve(output, `${file}-${width}-${label}.png`),
            shot,
          );
          shots.push(PNG.sync.read(shot));
          await context.close();
        }
        const [b, a] = shots;
        let pixels = null;
        const dimensions = a.width === b.width && a.height === b.height;
        if (dimensions) {
          const diff = new PNG({ width: a.width, height: a.height });
          pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
            threshold: 0.1,
          });
          if (pixels)
            await writeFile(
              resolve(output, `${file}-${width}-diff.png`),
              PNG.sync.write(diff),
            );
        }
        const row = {
          page: path,
          width,
          dimensions,
          geometryDifferences: structure[0].geometry
            .map((r, i) =>
              JSON.stringify(r) === JSON.stringify(structure[1].geometry[i])
                ? null
                : { react: r, reference: structure[1].geometry[i] },
            )
            .filter(Boolean),
          geometryEqual:
            JSON.stringify(structure[0].geometry) ===
            JSON.stringify(structure[1].geometry),
          referenceSize: [a.width, a.height],
          reactSize: [b.width, b.height],
          captureAttempts: attempt + 1,
          firstDifferentPixels,
          differentPixels: pixels,
          ratio: pixels === null ? null : pixels / (a.width * a.height),
          headingsEqual:
            JSON.stringify(structure[0].headings) ===
            JSON.stringify(structure[1].headings),
          imagesEqual:
            JSON.stringify(structure[0].images) ===
            JSON.stringify(structure[1].images),
        };
        const existing = results.findIndex(
          (r) => r.page === row.page && r.width === row.width,
        );
        if (existing >= 0) results[existing] = row;
        else results.push(row);
        console.log(JSON.stringify(row));
        await writeFile(
          resolve(output, 'report.json'),
          JSON.stringify(results, null, 2),
        );
        if (
          attempt === 0 &&
          row.geometryEqual &&
          row.dimensions &&
          row.headingsEqual &&
          row.imagesEqual &&
          pixels > 0 &&
          pixels <= 50
        ) {
          firstDifferentPixels = pixels;
          continue;
        }
        break;
      }
    }
  await writeFile(
    resolve(output, 'report.json'),
    JSON.stringify(results, null, 2),
  );
  if (
    results.some(
      (r) =>
        !r.dimensions ||
        !r.geometryEqual ||
        !r.headingsEqual ||
        !r.imagesEqual ||
        r.differentPixels !== 0,
    )
  )
    throw Error(
      'Published-site visual differences remain; inspect artifacts/published-parity/report.json.',
    );
} finally {
  await browser?.close();
  appServer?.kill();
  await new Promise((r) => original.close(r));
}
