import { access } from 'node:fs/promises';
if (!['mysql', 'mariadb'].includes(process.env.APP_DB_TYPE || 'mysql'))
  throw Error('APP_DB_TYPE debe ser mysql o mariadb.');
const required = [
  'APP_ORIGIN',
  'CSRF_SECRET',
  'APP_DB_HOST',
  'APP_DB_NAME',
  'APP_DB_USER',
  'APP_DB_PASSWORD',
];
for (const key of required)
  if (!process.env[key])
    throw Error(
      'Falta ' + key + '; configúralo en hPanel, sin incluirlo en Git.',
    );
const origin = new URL(process.env.APP_ORIGIN);
if (origin.protocol !== 'https:' || origin.origin !== process.env.APP_ORIGIN)
  throw Error(
    'APP_ORIGIN debe ser un origen HTTPS exacto, sin ruta ni slash final.',
  );
if (
  process.env.NODE_ENV !== 'production' ||
  process.env.SERVE_WEB !== '1' ||
  process.env.LISTEN_HOST !== '0.0.0.0'
)
  throw Error(
    'Configura NODE_ENV=production, SERVE_WEB=1 y LISTEN_HOST=0.0.0.0.',
  );
if (!/^[0-5]$/.test(process.env.TRUST_PROXY_HOPS || ''))
  throw Error(
    'Configura explícitamente TRUST_PROXY_HOPS según el proxy verificado del alojamiento.',
  );
if (process.env.CSRF_SECRET.length < 32)
  throw Error('CSRF_SECRET debe contener al menos 32 caracteres aleatorios.');
if (!['legacy', 'system'].includes(process.env.PUBLIC_DATA_SOURCE || ''))
  throw Error('Selecciona PUBLIC_DATA_SOURCE explícitamente.');
if (
  process.env.APP_DB_NAME === process.env.LEGACY_DB_NAME &&
  process.env.APP_DB_HOST === (process.env.LEGACY_DB_HOST || '127.0.0.1') &&
  (process.env.APP_DB_PORT || '3306') === (process.env.LEGACY_DB_PORT || '3306')
)
  throw Error('La base nueva debe estar separada del origen legacy.');
await access('apps/api/dist/main.js');
await access('apps/web/dist/index.html');
console.log(
  JSON.stringify({
    configurationValid: true,
    publicDataSource: process.env.PUBLIC_DATA_SOURCE,
    buildPresent: true,
    connectedToDatabase: false,
    changedTraffic: false,
  }),
);
