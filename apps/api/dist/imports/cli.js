"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const legacy_1 = require("./legacy");
async function main() {
    const [command, file, ...args] = process.argv.slice(2);
    if (!['inspect', 'plan'].includes(command) || !file)
        throw Error('Uso: inspect|plan /ruta/base.sql [--mapping /ruta/mapping.json] [--out /ruta/reporte.json]');
    let output, mapping = legacy_1.DEFAULT_MAPPING;
    const seenFlags = new Set();
    for (let i = 0; i < args.length; i += 2) {
        const flag = args[i], value = args[i + 1];
        if (!value)
            throw Error('Falta valor de ' + flag);
        if (seenFlags.has(flag))
            throw Error('Opción repetida: ' + flag);
        seenFlags.add(flag);
        if (flag === '--out' && !output)
            output = value;
        else if (flag === '--mapping' && command === 'plan')
            mapping = (0, legacy_1.validateMapping)(JSON.parse(await (0, promises_1.readFile)(value, 'utf8')));
        else
            throw Error('Opción no admitida: ' + flag);
    }
    const info = await (0, promises_1.stat)(file);
    if (!info.isFile() || info.size > 50 * 1024 * 1024)
        throw Error('El origen debe ser un archivo SQL de hasta 50 MiB.');
    const bytes = await (0, promises_1.readFile)(file), hash = (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
    const tables = (0, legacy_1.parseLegacy)(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const report = command === 'inspect'
        ? { sourceSha256: hash, ...(0, legacy_1.inspectLegacy)(tables) }
        : (0, legacy_1.buildPlan)(tables, hash, mapping);
    if (output) {
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(output), { recursive: true, mode: 0o700 });
        await (0, promises_1.writeFile)(output, JSON.stringify(report, null, 2) + '\n', {
            flag: 'wx',
            mode: 0o600,
        });
    }
    console.log(JSON.stringify({
        source: (0, node_path_1.basename)(file),
        sourceSha256: hash,
        command,
        counts: report.counts,
        totalRows: report.totalRows,
        issues: report.issues.reduce((a, i) => ({ ...a, [i.severity]: (a[i.severity] ?? 0) + 1 }), {}),
        ...('competitions' in report
            ? {
                editionPolicy: report.editionPolicy,
                mappingComplete: report.mappingComplete,
                competitions: report.competitions,
            }
            : {}),
        changesDatabase: false,
        reportWritten: !!output,
    }, null, 2));
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'No se pudo analizar el origen.');
    process.exitCode = 1;
});
