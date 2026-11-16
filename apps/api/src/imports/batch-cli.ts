import 'reflect-metadata';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createDataSource } from '../database/database.service';
import { ImportBatches, requireIsolatedTarget } from './batches';
import { parseLegacy, validateMapping, DEFAULT_MAPPING } from './legacy';
async function read(path: string) {
  const s = await stat(path);
  if (!s.isFile() || s.size > 50 * 1024 * 1024)
    throw Error('Archivo inválido o mayor de 50 MiB.');
  return readFile(path);
}
async function main() {
  const [command, subject, ...args] = process.argv.slice(2);
  if (!['stage', 'report', 'decide', 'promote'].includes(command) || !subject)
    throw Error(
      'Uso: stage <SQL>|report|decide|promote <batchId> --actor <UUID> [--mapping <JSON>|--out <JSON>|--decisions <JSON>|--config <JSON>]',
    );
  const options: Record<string, string> = {};
  const flags: Record<string, string[]> = {
    stage: ['--actor', '--mapping'],
    report: ['--actor', '--out'],
    decide: ['--actor', '--decisions'],
    promote: ['--actor', '--config'],
  };
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i],
      v = args[i + 1];
    if (!flags[command].includes(k) || !v || options[k])
      throw Error('Opción inválida o repetida.');
    options[k] = v;
  }
  const actor = options['--actor'];
  if (!actor || !/^[a-f0-9-]{36}$/.test(actor))
    throw Error('Se requiere UUID de administrador.');
  if (command !== 'stage' && !/^[a-f0-9]{64}$/.test(subject))
    throw Error('Identificador de lote inválido.');
  for (const [cmd, flag] of [
    ['report', '--out'],
    ['decide', '--decisions'],
    ['promote', '--config'],
  ])
    if (command === cmd && !options[flag]) throw Error('Falta ' + flag);
  const db = createDataSource();
  requireIsolatedTarget(db.options as any);
  try {
    await db.initialize();
    const service = new ImportBatches(db);
    let result;
    if (command === 'stage') {
      const bytes = await read(subject);
      const mapping = options['--mapping']
        ? validateMapping(
            JSON.parse(
              new TextDecoder('utf-8', { fatal: true }).decode(
                await read(options['--mapping']),
              ),
            ),
          )
        : DEFAULT_MAPPING;
      result = await service.stage(
        actor,
        parseLegacy(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
        createHash('sha256').update(bytes).digest('hex'),
        mapping,
      );
    } else if (command === 'decide')
      result = await service.decide(
        actor,
        subject,
        JSON.parse((await read(options['--decisions'])).toString('utf8')),
      );
    else if (command === 'promote')
      result = await service.promote(
        actor,
        subject,
        JSON.parse((await read(options['--config'])).toString('utf8')),
      );
    else {
      const report = await service.report(actor, subject);
      const output = options['--out'];
      await mkdir(dirname(output), { recursive: true, mode: 0o700 });
      await writeFile(output, JSON.stringify(report, null, 2) + '\n', {
        flag: 'wx',
        mode: 0o600,
      });
      result = {
        batchId: subject,
        status: report.status,
        rows: report.rows,
        pendingStatistics: report.pendingStatistics.length,
        mappings: report.mappings,
        reportWritten: true,
      };
    }
    console.log(JSON.stringify(result));
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'No se completó la importación.',
  );
  process.exitCode = 1;
});
