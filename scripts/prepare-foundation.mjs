import { createDataSource } from '../apps/api/dist/database/database.service.js';
import { Foundation1794225600000 } from '../apps/api/dist/database/migrations/1794225600000-foundation.js';
if (!/^smoky_system_test_[a-f0-9]+$/.test(process.env.APP_DB_NAME ?? ''))
  throw Error('This helper only runs on disposable test databases.');
const source = createDataSource().setOptions({
  migrations: [Foundation1794225600000],
});
try {
  await source.initialize();
  await source.runMigrations({ transaction: 'none' });
} finally {
  if (source.isInitialized) await source.destroy();
}
