import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
test('Hostinger preflight validates configuration without opening database connections', (t) => {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    APP_ORIGIN: 'https://example.test',
    CSRF_SECRET: 'x'.repeat(32),
    APP_DB_HOST: '127.0.0.1',
    APP_DB_NAME: 'unused_preflight',
    APP_DB_USER: 'unused',
    APP_DB_PASSWORD: 'unused-test-only',
    SERVE_WEB: '1',
    LISTEN_HOST: '0.0.0.0',
    TRUST_PROXY_HOPS: '1',
    PUBLIC_DATA_SOURCE: 'system',
    LEGACY_DB_NAME: '',
  };
  const directory = mkdtempSync(join(tmpdir(), 'hosting-preflight-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const path of ['apps/api/dist', 'apps/web/dist'])
    mkdirSync(join(directory, path), { recursive: true });
  writeFileSync(join(directory, 'apps/api/dist/main.js'), '');
  writeFileSync(join(directory, 'apps/web/dist/index.html'), '');
  const run = (values: NodeJS.ProcessEnv) =>
    spawnSync(process.execPath, [resolve('scripts/hostinger-preflight.mjs')], {
      cwd: directory,
      env: values,
      encoding: 'utf8',
    });
  const valid = run(env);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).connectedToDatabase, false);
  assert.ok(!valid.stdout.includes(env.APP_DB_PASSWORD));
  for (const change of [
    { APP_ORIGIN: 'http://example.test' },
    { APP_ORIGIN: 'https://example.test/path' },
    { CSRF_SECRET: '' },
    { TRUST_PROXY_HOPS: 'true' },
    { PUBLIC_DATA_SOURCE: 'other' },
    { APP_DB_TYPE: 'postgres' },
  ])
    assert.notEqual(run({ ...env, ...change }).status, 0);
  rmSync(join(directory, 'apps/api/dist/main.js'));
  const missingBuild = run(env);
  assert.notEqual(missingBuild.status, 0);
  assert.match(missingBuild.stderr, /apps\/api\/dist\/main\.js/);
});
