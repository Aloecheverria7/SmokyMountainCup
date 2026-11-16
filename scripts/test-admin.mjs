import { testDatabase } from './test-database.mjs';
const engine = testDatabase();
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { createPool } from 'mysql2/promise';
import assert from 'node:assert/strict';
import { sportsChecks } from './sports-checks.mjs';
const suffix = randomBytes(5).toString('hex'),
  name = `smoky-admin-test-${suffix}`,
  database = `smoky_system_test_${suffix}`,
  password = randomBytes(24).toString('hex');
const testPassword = randomBytes(20).toString('hex');
let app,
  pool,
  started = false;
let checks = 0;
const ok = (condition, label) => {
  assert.ok(condition, label);
  checks++;
  console.log('PASS ' + label);
};
function command(executable, args, env, input) {
  const r = spawnSync(executable, args, {
    env,
    input,
    encoding: 'utf8',
    timeout: 120000,
  });
  if (r.status !== 0)
    throw Error(
      `${executable} failed: ${r.stdout || ''}\n${r.stderr || r.error || ''}`,
    );
  return r.stdout.trim();
}
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const p = server.address().port;
      server.close(() => resolve(p));
    });
  });
class Client {
  cookies = new Map();
  token = '';
  pending;
  constructor(base) {
    this.base = base;
  }
  async send(path, method = 'GET', body, options = {}) {
    if (method !== 'GET' && !options.noCsrf && !this.token) {
      this.pending ??= this.send('auth/csrf')
        .then((r) => (this.token = r.body.token))
        .finally(() => (this.pending = undefined));
      await this.pending;
    }
    const r = await fetch(this.base + path, {
      method,
      headers: {
        Origin: 'http://127.0.0.1:5173',
        Cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '),
        ...(method !== 'GET'
          ? { 'Content-Type': 'application/json', 'X-CSRF-Token': this.token }
          : {}),
        ...options.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of r.headers.getSetCookie()) {
      const [entry] = cookie.split(';');
      const index = entry.indexOf('=');
      this.cookies.set(entry.slice(0, index), entry.slice(index + 1));
    }
    const parsed = r.status === 204 ? null : await r.json();
    if (['auth/login', 'auth/password', 'auth/logout'].includes(path) && r.ok)
      this.token = '';
    return { status: r.status, body: parsed };
  }
  login(email = 'admin@example.test', password = testPassword) {
    return this.send('auth/login', 'POST', { email, password });
  }
}
try {
  command(
    'docker',
    [
      'run',
      '--detach',
      '--rm',
      '--name',
      name,
      ...engine.args,
      '-p',
      '127.0.0.1::3306',
      engine.image,
    ],
    {
      ...process.env,
      ...engine.environment(database, password),
    },
  );
  started = true;
  console.log('Database engine under test: ' + engine.image);
  const mapping = command('docker', ['port', name, '3306/tcp']);
  const dbPort = Number(mapping.split(':').at(-1));
  pool = createPool({
    host: '127.0.0.1',
    port: dbPort,
    user: 'smoky_test',
    password,
    database,
    connectionLimit: 4,
  });
  let connected = false;
  for (let i = 0; i < 600; i++) {
    try {
      await pool.query('SELECT 1');
      connected = true;
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  ok(connected, `isolated ${engine.image} is ready`);
  const [[serverVersion]] = await pool.query('SELECT VERSION() AS version');
  console.log('Verified database version: ' + serverVersion.version);
  const port = await freePort();
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    APP_ORIGIN: 'http://127.0.0.1:5173',
    CSRF_SECRET: randomBytes(32).toString('hex'),
    APP_DB_TYPE: engine.type,
    APP_DB_HOST: '127.0.0.1',
    APP_DB_PORT: String(dbPort),
    APP_DB_NAME: database,
    APP_DB_USER: 'smoky_test',
    APP_DB_PASSWORD: password,
    LEGACY_DB_NAME: '',
    SMTP_HOST: '',
    PUBLIC_DATA_SOURCE: 'system',
  };
  command(process.execPath, ['scripts/prepare-foundation.mjs'], env);
  command(
    process.execPath,
    [
      'apps/api/dist/database/cli.js',
      'admin',
      'admin@example.test',
      'Test administrator',
    ],
    env,
    testPassword + '\n',
  );
  command(process.execPath, ['apps/api/dist/database/cli.js', 'migrate'], env);
  command(process.execPath, ['apps/api/dist/database/cli.js', 'migrate'], env);
  const [migrations] = await pool.query('SELECT * FROM smc_migrations');
  ok(migrations.length === 3, 'migrations are repeatable');
  const [admins] = await pool.query('SELECT * FROM smc_users');
  ok(
    admins.length === 1 &&
      admins[0].password_hash.startsWith('$argon2id$') &&
      !admins[0].password_hash.includes(testPassword),
    'bootstrap stores an Argon2id hash',
  );
  app = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env,
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}/api/v1/`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + 'health/live')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  ok(ready, `NestJS starts against isolated ${engine.image}`);
  const admin = new Client(base),
    anonymous = new Client(base);
  ok(
    (await anonymous.send('users')).status === 401,
    'anonymous user cannot read staff',
  );
  ok(
    (
      await anonymous.send(
        'auth/login',
        'POST',
        { email: 'admin@example.test', password: testPassword },
        { noCsrf: true },
      )
    ).status === 403,
    'login rejects missing CSRF',
  );
  ok(
    (await anonymous.login('admin@example.test', 'incorrect-password'))
      .status === 401,
    'wrong password is rejected',
  );
  ok((await admin.login()).status === 200, 'administrator login succeeds');
  const me = (await admin.send('auth/me')).body.data;
  ok(
    !JSON.stringify(me).includes('hash') && me.role === 'admin',
    'session exposes only safe user data',
  );
  const [sessions] = await pool.query('SELECT token_hash FROM smc_sessions');
  ok(
    sessions[0].token_hash !== admin.cookies.get('cup_session'),
    'opaque session token is stored only as a hash',
  );
  ok(
    (await admin.send('teams', 'POST', { name: 'Invalid', role: 'admin' }))
      .status === 400,
    'unknown properties are rejected',
  );
  const first = (
    await admin.send('seasons', 'POST', {
      name: 'Season one',
      timezone: 'America/New_York',
    })
  ).body.data;
  const second = (
    await admin.send('seasons', 'POST', {
      name: 'Season two',
      timezone: 'America/New_York',
    })
  ).body.data;
  const competitions = (await admin.send(`seasons/${first.id}/competitions`))
    .body.data;
  ok(
    competitions.length === 4 &&
      competitions.every((c) => c.groups.map((g) => g.name).join('') === 'AB'),
    'new season creates four independent competitions and eight A/B groups',
  );
  const activations = await Promise.all([
    admin.send(`seasons/${first.id}/activate`, 'POST', { expectedVersion: 0 }),
    admin.send(`seasons/${second.id}/activate`, 'POST', { expectedVersion: 0 }),
  ]);
  const seasons = (await admin.send('seasons?limit=100')).body.data;
  ok(
    activations.every((r) => r.status === 201) &&
      seasons.filter((s) => s.active).length === 1,
    'concurrent activation leaves exactly one active season',
  );
  const fresh = seasons.find((s) => s.id === first.id);
  ok(
    (
      await admin.send(`seasons/${first.id}`, 'PATCH', {
        expectedVersion: 0,
        name: 'Outdated',
      })
    ).status === 409,
    'stale versions cannot overwrite a season',
  );
  const teams = [];
  for (let i = 0; i < 3; i++)
    teams.push(
      (await admin.send('teams', 'POST', { name: 'Galacticos' })).body.data,
    );
  ok(
    new Set(teams.map((t) => t.id)).size === 3,
    'same-name teams retain separate identities',
  );
  const listing = (await admin.send('teams?limit=2')).body;
  const next = (
    await admin.send('teams?limit=2&cursor=' + listing.page.nextCursor)
  ).body;
  ok(
    listing.data.length === 2 &&
      next.data.length === 1 &&
      !listing.data.some((a) => next.data.some((b) => b.id === a.id)),
    'cursor pagination does not repeat rows',
  );
  const duplicate = await Promise.all([
    admin.send(`competitions/${competitions[0].id}/entries`, 'POST', {
      teamId: teams[0].id,
    }),
    admin.send(`competitions/${competitions[0].id}/entries`, 'POST', {
      teamId: teams[0].id,
    }),
  ]);
  ok(
    duplicate
      .map((r) => r.status)
      .sort()
      .join(',') === '201,409',
    'concurrent duplicate registration is rejected',
  );
  ok(
    (
      await admin.send(`competitions/${competitions[1].id}/entries`, 'POST', {
        teamId: teams[0].id,
      })
    ).status === 201,
    'team can register independently in another competition',
  );
  await admin.send(`teams/${teams[1].id}/archive`, 'POST', {
    expectedVersion: 0,
  });
  ok(
    (
      await admin.send(`competitions/${competitions[0].id}/entries`, 'POST', {
        teamId: teams[1].id,
      })
    ).status === 422,
    'archived teams cannot register',
  );
  const rules = {
    expectedVersion: 0,
    duration: 45,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    groupCapacity: 4,
    qualifiers: 2,
    rulesConfirmed: true,
  };
  ok(
    (await admin.send(`competitions/${competitions[0].id}`, 'PATCH', rules))
      .status === 200,
    'competition rules persist with explicit confirmation',
  );
  ok(
    (
      await admin.send(`competitions/${competitions[0].id}`, 'PATCH', {
        ...rules,
        expectedVersion: 1,
        qualifiers: 4,
      })
    ).status === 422,
    'invalid qualifier capacity is rejected',
  );
  await admin.send(`seasons/${first.id}/archive`, 'POST', {
    expectedVersion: fresh.version,
  });
  const archived = (await admin.send('seasons?limit=100')).body.data.find(
    (s) => s.id === first.id,
  );
  ok(
    (
      await admin.send(`seasons/${first.id}/activate`, 'POST', {
        expectedVersion: archived.version,
      })
    ).status === 422,
    'archived season cannot activate',
  );
  ok(
    (
      await admin.send(`competitions/${competitions[1].id}/entries`, 'POST', {
        teamId: teams[2].id,
      })
    ).status === 422,
    'archived season does not accept registrations',
  );
  const scorerPassword = randomBytes(20).toString('hex');
  const scorer = (
    await admin.send('users', 'POST', {
      name: 'Scorer',
      email: 'scorer@example.test',
      role: 'scorer',
      password: scorerPassword,
    })
  ).body.data;
  const scorerClient = new Client(base);
  await scorerClient.login(scorer.email, scorerPassword);
  ok(
    (await scorerClient.send('users')).status === 403,
    'scorer cannot access user management',
  );
  const scorerNew = randomBytes(20).toString('hex');
  ok(
    (
      await scorerClient.send('auth/password', 'POST', {
        currentPassword: scorerPassword,
        newPassword: scorerNew,
      })
    ).status === 200,
    'new account can change its mandatory initial password',
  );
  ok(
    (await scorerClient.send('seasons')).status === 403,
    'scorer still cannot access administrative catalogs',
  );
  const secondSession = new Client(base);
  await secondSession.login(scorer.email, scorerNew);
  const changed = randomBytes(20).toString('hex');
  await scorerClient.send('auth/password', 'POST', {
    currentPassword: scorerNew,
    newPassword: changed,
  });
  ok(
    (await secondSession.send('auth/me')).status === 401,
    'password change revokes other sessions',
  );
  const scorerFresh = (await admin.send('users?limit=100')).body.data.find(
    (u) => u.id === scorer.id,
  );
  await admin.send(`users/${scorer.id}`, 'PATCH', {
    expectedVersion: scorerFresh.version,
    active: false,
  });
  ok(
    (await scorerClient.send('auth/me')).status === 401,
    'deactivating a user revokes sessions',
  );
  ok(
    (
      await admin.send(`users/${me.id}`, 'PATCH', {
        expectedVersion: me.version,
        active: false,
      })
    ).status === 422,
    'administrator cannot deactivate their own account',
  );
  ok(
    (
      await admin.send(`users/${me.id}`, 'PATCH', {
        expectedVersion: me.version,
        role: 'scorer',
      })
    ).status === 422,
    'administrator cannot remove their own role',
  );
  const temp = randomBytes(20).toString('hex');
  const user = (
    await admin.send('users', 'POST', {
      name: 'Other admin',
      email: 'other@example.test',
      role: 'admin',
      password: temp,
    })
  ).body.data;
  const other = new Client(base);
  await other.login(user.email, temp);
  ok(
    (await other.send('seasons')).status === 403,
    'new administrator must change initial password before using catalogs',
  );
  const otherPassword = randomBytes(20).toString('hex');
  await other.send('auth/password', 'POST', {
    currentPassword: temp,
    newPassword: otherPassword,
  });
  ok(
    (await other.send('seasons')).status === 200,
    'administrator catalog access works after mandatory change',
  );
  const userFresh = (await admin.send('users?limit=100')).body.data.find(
    (u) => u.id === user.id,
  );
  const reset = randomBytes(20).toString('hex');
  await admin.send(`users/${user.id}/reset-password`, 'POST', {
    expectedVersion: userFresh.version,
    password: reset,
  });
  ok(
    (await other.send('auth/me')).status === 401,
    'administrative password reset revokes all target sessions',
  );
  await other.login(user.email, reset);
  ok(
    (await other.send('auth/me')).body.data.mustChangePassword,
    'reset requires another password change',
  );
  const audit = JSON.stringify((await admin.send('audit?limit=100')).body);
  ok(
    audit.includes('season.create') &&
      audit.includes('entry.create') &&
      !audit.includes(testPassword) &&
      !audit.includes('password_hash') &&
      !audit.includes('token_hash'),
    'audit records operations without credential material',
  );
  await admin.send('auth/logout', 'POST');
  ok(
    (await admin.send('seasons')).status === 401,
    'logout makes the previous session unusable',
  );
  await admin.login();
  await sportsChecks({ admin, Client, pool, base, ok });
  console.log(`${checks} ${engine.image}/API checks passed.`);
  if (!process.argv.includes('--api-only')) {
    const browserOutput = command('npm', ['run', 'test:e2e'], {
      ...env,
      API_PROXY_TARGET: `http://127.0.0.1:${port}`,
      SMC_ADMIN_TEST: '1',
      SMC_TEST_EMAIL: 'admin@example.test',
      SMC_TEST_PASSWORD: testPassword,
    });
    console.log(browserOutput);
    console.log('Browser suite passed against the real isolated API.');
  }
} finally {
  app?.kill();
  await pool?.end();
  if (started) command('docker', ['rm', '--force', name], process.env);
}
