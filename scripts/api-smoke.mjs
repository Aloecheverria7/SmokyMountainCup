import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const port = String(31000 + Math.floor(Math.random() * 10000));
const server = spawn(process.execPath, ['apps/api/dist/main.js'], {
  env: {
    ...process.env,
    PORT: port,
    APP_ORIGIN: 'http://127.0.0.1:5173',
    CSRF_SECRET: randomBytes(32).toString('hex'),
    LEGACY_DB_NAME: '',
    APP_DB_NAME: '',
    PUBLIC_DATA_SOURCE: 'legacy',
    SMTP_HOST: '',
  },
  stdio: 'ignore',
});
const base = `http://127.0.0.1:${port}/api/v1`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/health/live')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, 'API starts');
  assert.equal((await fetch(base + '/public/live')).status, 503);
  assert.equal((await fetch(base + '/public/site')).status, 503);
  const r = await fetch(base + '/auth/csrf');
  const { token } = await r.json();
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const body = {
    kind: 'contact',
    name: 'Test',
    email: 'test@example.com',
    message: 'Local verification only',
  };
  const post = (headers, payload = body) =>
    fetch(base + '/public/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
  assert.equal((await post({})).status, 403);
  const headers = {
    Origin: 'http://127.0.0.1:5173',
    Cookie: cookie,
    'X-CSRF-Token': token,
  };
  assert.equal((await post(headers)).status, 503);
  assert.equal((await post(headers, { ...body, admin: true })).status, 400);
  assert.equal(
    (await post({ ...headers, Origin: 'https://untrusted.example' })).status,
    403,
  );
  assert.equal(
    (
      await post(headers, {
        kind: 'vendor',
        name: 'Test vendor',
        email: 'test@example.com',
        phone: '5551234567',
      })
    ).status,
    503,
  );
  console.log('8 API checks passed; no database access or mail delivery.');
} finally {
  server.kill();
}
