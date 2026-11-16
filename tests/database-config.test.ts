import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDataSource,
  databaseType,
} from '../apps/api/src/database/database.service';
test('new system selects MySQL by default and keeps explicit MariaDB support', () => {
  assert.equal(databaseType({}), 'mysql');
  assert.equal(databaseType({ APP_DB_TYPE: 'mysql' }), 'mysql');
  assert.equal(databaseType({ APP_DB_TYPE: 'mariadb' }), 'mariadb');
  assert.throws(() => databaseType({ APP_DB_TYPE: 'postgres' }), /APP_DB_TYPE/);
});
test('both drivers keep controlled migrations and an isolated connection configuration', () => {
  const before = { ...process.env };
  try {
    Object.assign(process.env, {
      APP_DB_NAME: 'smoky_configuration_only',
      LEGACY_DB_NAME: '',
      APP_DB_HOST: '127.0.0.1',
      APP_DB_PORT: '3306',
    });
    for (const type of ['mysql', 'mariadb']) {
      process.env.APP_DB_TYPE = type;
      const options = createDataSource().options;
      assert.equal(options.type, type);
      assert.equal(options.synchronize, false);
      assert.equal(options.migrationsRun, false);
    }
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
