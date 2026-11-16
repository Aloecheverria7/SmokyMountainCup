import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import {
  parseLegacy,
  inspectLegacy,
  buildPlan,
  DEFAULT_MAPPING,
  validateMapping,
} from './legacy';
async function main() {
  const [command, file, ...args] = process.argv.slice(2);
  if (!['inspect', 'plan'].includes(command) || !file)
    throw Error(
      'Uso: inspect|plan /ruta/base.sql [--mapping /ruta/mapping.json] [--out /ruta/reporte.json]',
    );
  let output: string | undefined,
    mapping = DEFAULT_MAPPING;
  const seenFlags = new Set<string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i],
      value = args[i + 1];
    if (!value) throw Error('Falta valor de ' + flag);
    if (seenFlags.has(flag)) throw Error('Opción repetida: ' + flag);
    seenFlags.add(flag);
    if (flag === '--out' && !output) output = value;
    else if (flag === '--mapping' && command === 'plan')
      mapping = validateMapping(JSON.parse(await readFile(value, 'utf8')));
    else throw Error('Opción no admitida: ' + flag);
  }
  const info = await stat(file);
  if (!info.isFile() || info.size > 50 * 1024 * 1024)
    throw Error('El origen debe ser un archivo SQL de hasta 50 MiB.');
  const bytes = await readFile(file),
    hash = createHash('sha256').update(bytes).digest('hex');
  const tables = parseLegacy(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  );
  const report =
    command === 'inspect'
      ? { sourceSha256: hash, ...inspectLegacy(tables) }
      : buildPlan(tables, hash, mapping);
  if (output) {
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, JSON.stringify(report, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  }
  console.log(
    JSON.stringify(
      {
        source: basename(file),
        sourceSha256: hash,
        command,
        counts: report.counts,
        totalRows: report.totalRows,
        issues: report.issues.reduce(
          (a, i) => ({ ...a, [i.severity]: (a[i.severity] ?? 0) + 1 }),
          {} as Record<string, number>,
        ),
        ...('competitions' in report
          ? {
              editionPolicy: report.editionPolicy,
              mappingComplete: report.mappingComplete,
              competitions: report.competitions,
            }
          : {}),
        changesDatabase: false,
        reportWritten: !!output,
      },
      null,
      2,
    ),
  );
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'No se pudo analizar el origen.',
  );
  process.exitCode = 1;
});
