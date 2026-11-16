export function testDatabase(env = process.env) {
  const type = env.SMC_TEST_DB_TYPE || 'mysql';
  if (!['mysql', 'mariadb'].includes(type))
    throw Error('SMC_TEST_DB_TYPE must be mysql or mariadb.');
  const version =
    env.SMC_TEST_DB_VERSION || (type === 'mysql' ? '8.4' : '11.8');
  if (!(type === 'mysql' ? ['8.0', '8.4'] : ['11.8']).includes(version))
    throw Error('Unsupported isolated database test version.');
  const prefix = type === 'mysql' ? 'MYSQL' : 'MARIADB';
  return {
    type,
    version,
    image: `${type}:${version}`,
    prefix,
    args: [
      '-e',
      `${prefix}_RANDOM_ROOT_PASSWORD=1`,
      '-e',
      `${prefix}_DATABASE`,
      '-e',
      `${prefix}_USER`,
      '-e',
      `${prefix}_PASSWORD`,
    ],
    environment: (database, password) => ({
      [`${prefix}_DATABASE`]: database,
      [`${prefix}_USER`]: 'smoky_test',
      [`${prefix}_PASSWORD`]: password,
    }),
  };
}
