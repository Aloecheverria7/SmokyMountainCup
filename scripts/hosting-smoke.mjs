import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const server = spawn(
  process.execPath,
  [process.env.SMC_HOSTING_ENTRY || 'apps/api/dist/main.js'],
  {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      LISTEN_HOST: '127.0.0.1',
      SERVE_WEB: '1',
      TRUST_PROXY_HOPS: '1',
      APP_ORIGIN: `https://example.test`,
      CSRF_SECRET: randomBytes(32).toString('hex'),
      APP_DB_NAME: '',
      LEGACY_DB_NAME: '',
      PUBLIC_DATA_SOURCE: 'legacy',
      SMTP_HOST: '',
    },
    stdio: 'ignore',
  },
);
let checks = 0;
const ok = (v, label) => {
  assert.ok(v, label);
  checks++;
  console.log('PASS ' + label);
};
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/v1/health/live')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  ok(ready, 'managed hosting entry point starts without automatic migrations');
  for (const path of [
    '/',
    '/index.php',
    '/about.php',
    '/gallery.php',
    '/contact.php',
    '/schedule.php',
    '/games-details.php',
    '/games-results.php',
    '/games-boxScores.php',
    '/games-calendar.php',
    '/games-list.php',
    '/games-blocks.php',
    '/blog.php',
    '/leaguetable.php',
    '/player-details.php',
    '/player-gallery.php',
    '/player-list.php',
    '/player-statics.php',
    '/thank-you.php',
    '/sorry.php',
    '/tournament.php?category=infantil',
    '/match.php?id=unknown',
    '/admin/',
  ]) {
    const r = await fetch(base + path);
    ok(
      r.ok &&
        r.headers.get('content-type').includes('text/html') &&
        (await r.text()).includes('id="root"'),
      'React route served: ' + path,
    );
  }
  const home = await fetch(base + '/');
  const csp = home.headers.get('content-security-policy') || '';
  ok(
    csp.includes('frame-src') &&
      csp.includes('https://www.facebook.com') &&
      !csp.includes("'unsafe-eval'"),
    'published embeds are allowed without executable string evaluation',
  );
  const html = await home.text();
  const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
  const script = await fetch(base + asset);
  const scriptBytes = await script.arrayBuffer();
  ok(
    script.ok && scriptBytes.byteLength > 0,
    'built JavaScript is served by the same origin',
  );
  for (const path of [
    '/api/v1/does-not-exist',
    '/.env',
    '/package.json',
    '/apps/api/src/main.ts',
    '/artifacts/private.json',
    '/assets/absent.js',
  ]) {
    const r = await fetch(base + path);
    ok(
      r.status === 404 || r.status === 403,
      'private or missing route is not a SPA fallback: ' + path,
    );
  }
  const csrf = await fetch(base + '/api/v1/auth/csrf');
  const cookie = csrf.headers.get('set-cookie');
  ok(
    cookie.includes('Secure') &&
      cookie.includes('HttpOnly') &&
      cookie.includes('SameSite=Strict'),
    'production CSRF cookie remains secure behind a proxy',
  );
  ok(
    (await fetch(base + '/api/v1/health/ready')).status === 503,
    'readiness fails closed until the prepared database is connected',
  );
  const health = await fetch(base + '/api/v1/health/live');
  ok(
    health.headers.get('cache-control') === 'no-store',
    'API keeps no-store headers with static hosting',
  );
  console.log(
    `${checks} hosting checks passed; no database writes or mail delivery.`,
  );
} finally {
  server.kill();
}
