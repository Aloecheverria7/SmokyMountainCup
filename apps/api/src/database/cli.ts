import 'reflect-metadata';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { isEmail } from 'class-validator';
import { createDataSource, DatabaseService } from './database.service';
import { AuthService } from '../auth/auth.service';
async function secret() {
  const output = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output,
    terminal: !!process.stdin.isTTY,
  });
  if (process.stdin.isTTY)
    process.stdout.write('Contraseña inicial (no se muestra): ');
  try {
    return await new Promise<string>((resolve, reject) => {
      let answered = false;
      rl.on('close', () => {
        if (!answered) reject(new Error('No se recibió contraseña por stdin.'));
      });
      rl.question('', (value) => {
        answered = true;
        resolve(value);
      });
    });
  } finally {
    rl.close();
    if (process.stdin.isTTY) process.stdout.write('\n');
  }
}
async function main() {
  const command = process.argv[2];
  if (command === 'migrate') {
    const source = createDataSource();
    try {
      await source.initialize();
      const migrations = await source.runMigrations({ transaction: 'none' });
      console.log(`Migraciones aplicadas: ${migrations.length}.`);
    } finally {
      if (source.isInitialized) await source.destroy();
    }
    return;
  }
  if (command === 'admin') {
    const email = process.argv[3],
      name = process.argv[4];
    if (
      !email ||
      !isEmail(email) ||
      email.length > 160 ||
      !name?.trim() ||
      name.length > 120
    )
      throw Error('Uso: admin <email> <nombre>; contraseña por stdin.');
    const db = new DatabaseService();
    try {
      const auth = new AuthService(db);
      const id = await auth.createInitialAdmin(
        name.trim(),
        email,
        await secret(),
      );
      console.log(`Administrador creado: ${id}.`);
    } finally {
      await db.onModuleDestroy();
    }
    return;
  }
  throw Error('Comando esperado: migrate o admin.');
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'No se completó la operación.',
  );
  process.exitCode = 1;
});
