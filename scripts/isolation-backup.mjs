import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
function command(args, input) {
  const r = spawnSync('docker', args, {
    input,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw Error(
      'No se completó el respaldo/restauración aislado. Revisa el contenedor; no se muestran datos ni credenciales.',
    );
  return r.stdout;
}
function target(container) {
  if (!/^smoky-import-test-[a-f0-9]{10}$/.test(container))
    throw Error('Solo se admiten contenedores desechables de ensayo.');
  const info = JSON.parse(command(['inspect', container]))[0];
  const env = Object.fromEntries(
    info.Config.Env.map((v) => {
      const i = v.indexOf('=');
      return [v.slice(0, i), v.slice(i + 1)];
    }),
  );
  const engine = info.Config.Image.startsWith('mysql:')
    ? 'mysql'
    : info.Config.Image.startsWith('mariadb:')
      ? 'mariadb'
      : null;
  if (!engine) throw Error('Motor de ensayo no verificado.');
  const prefix = engine === 'mysql' ? 'MYSQL' : 'MARIADB';
  if (
    !/^smoky_import_test_[a-f0-9]{10}$/.test(env[prefix + '_DATABASE'] || '') ||
    env[prefix + '_USER'] !== 'smoky_test'
  )
    throw Error('Destino de ensayo no verificado.');
  return { database: env[prefix + '_DATABASE'], engine, prefix };
}
const client = ({ engine, prefix }) =>
  `MYSQL_PWD="$${prefix}_PASSWORD" ${engine === 'mysql' ? 'mysql' : 'mariadb'} --batch --skip-column-names --user="$${prefix}_USER" "$${prefix}_DATABASE"`;
export async function backupIsolated(container, directory) {
  const details = target(container),
    { database, engine, prefix } = details;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const sql = command([
    'exec',
    container,
    'sh',
    '-c',
    `MYSQL_PWD="$${prefix}_PASSWORD" ${engine === 'mysql' ? 'mysqldump --no-tablespaces --set-gtid-purged=OFF --column-statistics=0' : 'mariadb-dump'} --user="$${prefix}_USER" --single-transaction --skip-lock-tables --hex-blob --triggers "$${prefix}_DATABASE"`,
  ]);
  const bytes = Buffer.from(sql),
    sha256 = createHash('sha256').update(bytes).digest('hex');
  const file = join(directory, 'system-backup.sql'),
    manifest = join(directory, 'system-backup.json');
  await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
  await writeFile(
    manifest,
    JSON.stringify(
      {
        version: 1,
        database,
        engine,
        sha256,
        bytes: bytes.length,
        isolated: true,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  return { file, manifest, sha256 };
}
export async function restoreIsolated(container, file, manifest) {
  const details = target(container),
    { database, engine } = details,
    meta = JSON.parse(await readFile(manifest, 'utf8')),
    bytes = await readFile(file);
  if (
    meta.version !== 1 ||
    meta.isolated !== true ||
    meta.database !== database ||
    (meta.engine && meta.engine !== engine) ||
    meta.bytes !== bytes.length ||
    meta.sha256 !== createHash('sha256').update(bytes).digest('hex')
  )
    throw Error('El respaldo no coincide con su manifiesto.');
  const n = command([
    'exec',
    container,
    'sh',
    '-c',
    client(details) +
      " -e 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()'",
  ]).trim();
  if (n !== '0')
    throw Error('La restauración de ensayo requiere destino vacío.');
  command(['exec', '-i', container, 'sh', '-c', client(details)], bytes);
  return { database, sha256: meta.sha256 };
}
