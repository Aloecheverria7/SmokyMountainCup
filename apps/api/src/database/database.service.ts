import {
  Injectable,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { Imports1794225800000 } from './migrations/1794225800000-imports';
import { Sports1794225700000 } from './migrations/1794225700000-sports';
import { Foundation1794225600000 } from './migrations/1794225600000-foundation';
export type DbContext = Pick<EntityManager, 'query'>;
export function databaseType(env = process.env): 'mysql' | 'mariadb' {
  const type = env.APP_DB_TYPE || 'mysql';
  if (type !== 'mysql' && type !== 'mariadb')
    throw Error('APP_DB_TYPE must be mysql or mariadb.');
  return type;
}
export function createDataSource() {
  if (!process.env.APP_DB_NAME)
    throw new ServiceUnavailableException(
      'La base del sistema no está configurada.',
    );
  if (
    process.env.APP_DB_NAME === process.env.LEGACY_DB_NAME &&
    (process.env.APP_DB_HOST || '127.0.0.1') ===
      (process.env.LEGACY_DB_HOST || '127.0.0.1') &&
    (process.env.APP_DB_PORT || '3306') ===
      (process.env.LEGACY_DB_PORT || '3306')
  )
    throw new Error('Use a separate database for the new system.');
  return new DataSource({
    type: databaseType(),
    host: process.env.APP_DB_HOST || '127.0.0.1',
    port: Number(process.env.APP_DB_PORT || 3306),
    username: process.env.APP_DB_USER,
    password: process.env.APP_DB_PASSWORD,
    database: process.env.APP_DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    synchronize: false,
    migrationsRun: false,
    migrations: [
      Foundation1794225600000,
      Sports1794225700000,
      Imports1794225800000,
    ],
    migrationsTableName: 'smc_migrations',
    migrationsTransactionMode: 'none',
    extra: { connectionLimit: 5, multipleStatements: false },
  });
}
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private connection: Promise<DataSource> | undefined;
  async get() {
    this.connection ??= Promise.resolve()
      .then(async () => {
        const source = createDataSource();
        try {
          return await source.initialize();
        } catch {
          throw new ServiceUnavailableException(
            'La base del sistema no está disponible.',
          );
        }
      })
      .catch((e) => {
        this.connection = undefined;
        throw e;
      });
    return this.connection;
  }
  async query(sql: string, params: unknown[] = []) {
    return (await this.get()).query(sql, params);
  }
  async transaction<T>(fn: (tx: EntityManager) => Promise<T>) {
    return (await this.get()).transaction('READ COMMITTED', fn);
  }
  async snapshot<T>(fn: (tx: EntityManager) => Promise<T>) {
    return (await this.get()).transaction('REPEATABLE READ', fn);
  }
  async onModuleDestroy() {
    if (this.connection) {
      try {
        const source = await this.connection;
        if (source.isInitialized) await source.destroy();
      } catch {}
    }
  }
}
export async function audit(
  tx: DbContext,
  actorId: string | null,
  action: string,
  entity: string,
  id: string,
  details: Record<string, unknown> = {},
) {
  const { randomUUID } = await import('node:crypto');
  await tx.query(
    'INSERT INTO smc_audit(id,actor_id,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))',
    [randomUUID(), actorId, action, entity, id, JSON.stringify(details)],
  );
}
