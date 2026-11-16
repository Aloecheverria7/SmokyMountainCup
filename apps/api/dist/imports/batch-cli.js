"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const database_service_1 = require("../database/database.service");
const batches_1 = require("./batches");
const legacy_1 = require("./legacy");
async function read(path) {
    const s = await (0, promises_1.stat)(path);
    if (!s.isFile() || s.size > 50 * 1024 * 1024)
        throw Error('Archivo inválido o mayor de 50 MiB.');
    return (0, promises_1.readFile)(path);
}
async function main() {
    const [command, subject, ...args] = process.argv.slice(2);
    if (!['stage', 'report', 'decide', 'promote'].includes(command) || !subject)
        throw Error('Uso: stage <SQL>|report|decide|promote <batchId> --actor <UUID> [--mapping <JSON>|--out <JSON>|--decisions <JSON>|--config <JSON>]');
    const options = {};
    const flags = {
        stage: ['--actor', '--mapping'],
        report: ['--actor', '--out'],
        decide: ['--actor', '--decisions'],
        promote: ['--actor', '--config'],
    };
    for (let i = 0; i < args.length; i += 2) {
        const k = args[i], v = args[i + 1];
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
        if (command === cmd && !options[flag])
            throw Error('Falta ' + flag);
    const db = (0, database_service_1.createDataSource)();
    (0, batches_1.requireIsolatedTarget)(db.options);
    try {
        await db.initialize();
        const service = new batches_1.ImportBatches(db);
        let result;
        if (command === 'stage') {
            const bytes = await read(subject);
            const mapping = options['--mapping']
                ? (0, legacy_1.validateMapping)(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await read(options['--mapping']))))
                : legacy_1.DEFAULT_MAPPING;
            result = await service.stage(actor, (0, legacy_1.parseLegacy)(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex'), mapping);
        }
        else if (command === 'decide')
            result = await service.decide(actor, subject, JSON.parse((await read(options['--decisions'])).toString('utf8')));
        else if (command === 'promote')
            result = await service.promote(actor, subject, JSON.parse((await read(options['--config'])).toString('utf8')));
        else {
            const report = await service.report(actor, subject);
            const output = options['--out'];
            await (0, promises_1.mkdir)((0, node_path_1.dirname)(output), { recursive: true, mode: 0o700 });
            await (0, promises_1.writeFile)(output, JSON.stringify(report, null, 2) + '\n', {
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
    }
    finally {
        if (db.isInitialized)
            await db.destroy();
    }
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'No se completó la importación.');
    process.exitCode = 1;
});
