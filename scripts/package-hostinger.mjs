import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  copyFile,
  rm,
  chmod,
} from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = process.cwd(),
  artifacts = resolve(root, 'artifacts'),
  staging = join(artifacts, 'hostinger-' + randomUUID());
const sourceLock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const api = JSON.parse(await readFile('apps/api/package.json', 'utf8'));
const dependencies = Object.fromEntries(
  Object.keys(api.dependencies).map((name) => {
    const locked = sourceLock.packages['node_modules/' + name];
    if (!locked?.version) throw Error('Falta dependencia fijada: ' + name);
    return [name, locked.version];
  }),
);
const pkg = {
  name: 'smoky-mountain-hostinger',
  version: '0.1.0',
  private: true,
  main: 'server.js',
  engines: { node: '>=22.12' },
  scripts: {
    build: 'node scripts/verify-release.cjs',
    start: 'node server.js',
  },
  dependencies,
};
const files = [];
async function walk(path) {
  for (const e of await readdir(resolve(root, path), { withFileTypes: true })) {
    if (e.isSymbolicLink()) throw Error('No se empaquetan enlaces simbólicos.');
    if (e.isDirectory()) await walk(path + '/' + e.name);
    else if (e.isFile()) files.push(path + '/' + e.name);
  }
}
await walk('apps/api/dist');
await walk('apps/web/dist');
if (
  !files.includes('apps/api/dist/main.js') ||
  !files.includes('apps/web/dist/index.html')
)
  throw Error('Ejecuta npm run build antes de empaquetar.');
if (
  files.some(
    (f) =>
      /(^|\/)(\.env[^/]*|node_modules|artifacts|\.git)(\/|$)/.test(f) ||
      /\.(sql|log)$/i.test(f),
  )
)
  throw Error('El paquete contiene archivos no admitidos.');
await mkdir(staging, { recursive: true, mode: 0o700 });
try {
  for (const path of files) {
    const destination = join(staging, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(root, path), destination);
  }
  await writeFile(
    join(staging, 'package.json'),
    JSON.stringify(pkg, null, 2) + '\n',
  );
  // Seed the production lock from the tested repository to preserve transitive versions.
  const lock = structuredClone(sourceLock);
  lock.name = pkg.name;
  lock.packages[''] = {
    name: pkg.name,
    version: pkg.version,
    dependencies,
    engines: pkg.engines,
  };
  for (const path of Object.keys(lock.packages))
    if (path && (!path.startsWith('node_modules/') || lock.packages[path].link))
      delete lock.packages[path];
  await writeFile(
    join(staging, 'package-lock.json'),
    JSON.stringify(lock, null, 2) + '\n',
  );
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw Error('No se encontró la CLI de npm.');
  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv))
    if (
      [
        'npm_config_local_prefix',
        'npm_config_workspace',
        'npm_config_workspaces',
        'npm_package_json',
        'npm_lifecycle_event',
        'npm_lifecycle_script',
        'init_cwd',
      ].includes(key.toLowerCase())
    )
      delete childEnv[key];
  const install = spawnSync(
    process.execPath,
    [
      npmCli,
      'install',
      '--package-lock-only',
      '--ignore-scripts',
      '--omit=dev',
      '--no-audit',
      '--no-fund',
    ],
    { cwd: staging, encoding: 'utf8', timeout: 120000, env: childEnv },
  );
  if (install.status !== 0)
    throw Error(
      'No se pudo preparar el lockfile de producción: ' +
        (install.error?.message || install.stderr || install.stdout || 'error desconocido'),
    );
  const productionLock = JSON.parse(
    await readFile(join(staging, 'package-lock.json'), 'utf8'),
  );
  for (const [path, item] of Object.entries(productionLock.packages)) {
    if (!path) continue;
    if (
      !path.startsWith('node_modules/') ||
      item.link ||
      item.dev ||
      item.version !== sourceLock.packages[path]?.version
    )
      throw Error(
        'Dependencia de producción no coincide con la versión probada: ' + path,
      );
  }
  await writeFile(
    join(staging, 'server.js'),
    "'use strict';\nrequire('./apps/api/dist/main.js');\n",
  );
  await mkdir(join(staging, 'scripts'), { recursive: true });
  await writeFile(
    join(staging, 'scripts/verify-release.cjs'),
    `'use strict';
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const root=resolve(__dirname,'..');
const manifest=JSON.parse(readFileSync(resolve(root,'release-manifest.json'),'utf8'));
for(const f of manifest.files) {
  const bytes=readFileSync(resolve(root,f.path));
  if(bytes.length!==f.bytes || createHash('sha256').update(bytes).digest('hex')!==f.sha256) throw Error('Archivo de release incompleto o alterado: '+f.path);
}
console.log('Release NestJS/React precompilado verificado: '+manifest.files.length+' archivos.');
`,
  );
  files.push(
    'package.json',
    'package-lock.json',
    'server.js',
    'scripts/verify-release.cjs',
  );
  const manifest = {
    version: 2,
    layout: 'standalone-prebuilt',
    entry: 'server.js',
    createdAt: new Date().toISOString(),
    files: [],
  };
  for (const path of files.sort()) {
    const bytes = await readFile(join(staging, path));
    manifest.files.push({
      path,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    });
  }
  await writeFile(
    join(staging, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { mode: 0o600 },
  );
  const output = join(
    artifacts,
    'hostinger-standalone-' + randomUUID() + '.zip',
  );
  const zip = spawnSync('zip', ['-q', '-r', output, '.'], {
    cwd: staging,
    encoding: 'utf8',
    timeout: 120000,
  });
  if (zip.status !== 0)
    throw Error('No se pudo crear el ZIP; se requiere zip instalado.');
  await chmod(output, 0o600);
  console.log(
    JSON.stringify({
      file: relative(root, output),
      files: files.length,
      sha256: createHash('sha256')
        .update(await readFile(output))
        .digest('hex'),
      layout: manifest.layout,
      entry: manifest.entry,
      containsCredentials: false,
      containsOperationalSql: false,
    }),
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
