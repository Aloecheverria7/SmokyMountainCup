"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const node_readline_1 = require("node:readline");
const node_stream_1 = require("node:stream");
const class_validator_1 = require("class-validator");
const database_service_1 = require("./database.service");
const auth_service_1 = require("../auth/auth.service");
async function secret() {
    const output = new node_stream_1.Writable({
        write(_chunk, _enc, cb) {
            cb();
        },
    });
    const rl = (0, node_readline_1.createInterface)({
        input: process.stdin,
        output,
        terminal: !!process.stdin.isTTY,
    });
    if (process.stdin.isTTY)
        process.stdout.write('Contraseña inicial (no se muestra): ');
    try {
        return await new Promise((resolve, reject) => {
            let answered = false;
            rl.on('close', () => {
                if (!answered)
                    reject(new Error('No se recibió contraseña por stdin.'));
            });
            rl.question('', (value) => {
                answered = true;
                resolve(value);
            });
        });
    }
    finally {
        rl.close();
        if (process.stdin.isTTY)
            process.stdout.write('\n');
    }
}
async function main() {
    const command = process.argv[2];
    if (command === 'migrate') {
        const source = (0, database_service_1.createDataSource)();
        try {
            await source.initialize();
            const migrations = await source.runMigrations({ transaction: 'none' });
            console.log(`Migraciones aplicadas: ${migrations.length}.`);
        }
        finally {
            if (source.isInitialized)
                await source.destroy();
        }
        return;
    }
    if (command === 'admin') {
        const email = process.argv[3], name = process.argv[4];
        if (!email ||
            !(0, class_validator_1.isEmail)(email) ||
            email.length > 160 ||
            !name?.trim() ||
            name.length > 120)
            throw Error('Uso: admin <email> <nombre>; contraseña por stdin.');
        const db = new database_service_1.DatabaseService();
        try {
            const auth = new auth_service_1.AuthService(db);
            const id = await auth.createInitialAdmin(name.trim(), email, await secret());
            console.log(`Administrador creado: ${id}.`);
        }
        finally {
            await db.onModuleDestroy();
        }
        return;
    }
    throw Error('Comando esperado: migrate o admin.');
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'No se completó la operación.');
    process.exitCode = 1;
});
