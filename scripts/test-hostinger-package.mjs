import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const file = resolve(process.argv[2] || '');
assert.ok(file.endsWith('.zip'), 'Supply the generated ZIP path.');
const directory = await mkdtemp(
  join(tmpdir(), 'smoky-hostinger-package-test-'),
);
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0)
    throw Error(`${command} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
try {
  run('unzip', ['-q', file, '-d', directory]);
  const pkg = JSON.parse(
    await readFile(join(directory, 'package.json'), 'utf8'),
  );
  const lock = JSON.parse(
    await readFile(join(directory, 'package-lock.json'), 'utf8'),
  );
  assert.equal(pkg.workspaces, undefined);
  assert.equal(pkg.main, 'server.js');
  assert.ok(pkg.dependencies['@nestjs/core']);
  assert.ok(pkg.dependencies['hash-wasm']);
  assert.equal(pkg.dependencies.argon2, undefined);
  assert.equal(lock.packages['node_modules/argon2'], undefined);
  // Fresh Linux install from the actual ZIP; no repository node_modules or devDependencies.
  const output = run('docker', [
    'run',
    '--rm',
    '-v',
    `${directory}:/app`,
    '-v',
    `${resolve('scripts/hosting-smoke.mjs')}:/checks/hosting-smoke.mjs:ro`,
    '-w',
    '/app',
    '-e',
    'SMC_HOSTING_ENTRY=server.js',
    'node:24-bullseye',
    'sh',
    '-c',
    'set -e; npm ci --omit=dev --ignore-scripts --no-audit --no-fund; npm run build; ldd --version | head -n 1; node /checks/hosting-smoke.mjs',
  ]);
  assert.match(output, /35 hosting checks passed/);
  console.log(output);
  console.log(
    'Standalone ZIP passes a fresh production install and all hosting checks on GLIBC 2.31.',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
