import { isDeepStrictEqual } from 'node:util';
import { testDatabase } from './test-database.mjs';
const engine = testDatabase();
import { backupIsolated, restoreIsolated } from './isolation-backup.mjs';
import 'reflect-metadata';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createPool } from 'mysql2/promise';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  createDataSource,
} = require('../apps/api/dist/database/database.service.js');
const { ImportBatches } = require('../apps/api/dist/imports/batches.js');
const {
  buildPlan,
  parseLegacy,
  DEFAULT_MAPPING,
} = require('../apps/api/dist/imports/legacy.js');

const { fixture, sql } = await import('../tests/fixtures/legacy.ts');
const suffix = randomBytes(5).toString('hex'),
  name = 'smoky-import-test-' + suffix,
  database = 'smoky_import_test_' + suffix,
  password = randomBytes(24).toString('hex');
let restoreName, restorePool;
let started = false,
  pool,
  db,
  app,
  checks = 0;
const dir = await mkdtemp(join(tmpdir(), 'smoky-import-'));
function command(exe, args, env = process.env) {
  const r = spawnSync(exe, args, { env, encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0)
    throw Error((r.stdout || '') + (r.stderr || '') + (r.error || ''));
  return r.stdout.trim();
}
function ok(v, label) {
  assert.ok(v, label);
  checks++;
  console.log('PASS ' + label);
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
  const port = Number(
    command('docker', ['port', name, '3306/tcp']).split(':').at(-1),
  );
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    LEGACY_IMPORT_ISOLATED: '1',
    APP_DB_TYPE: engine.type,
    APP_DB_HOST: '127.0.0.1',
    APP_DB_PORT: String(port),
    APP_DB_NAME: database,
    APP_DB_USER: 'smoky_test',
    APP_DB_PASSWORD: password,
    LEGACY_DB_NAME: '',
  };
  Object.assign(process.env, env);
  pool = createPool({
    host: '127.0.0.1',
    port,
    user: 'smoky_test',
    password,
    database,
  });
  let ready = false;
  for (let i = 0; i < 600; i++) {
    try {
      await pool.query('SELECT 1');
      ready = true;
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  ok(ready, `disposable isolated ${engine.image} ready`);
  const [[serverVersion]] = await pool.query('SELECT VERSION() AS version');
  console.log('Verified database version: ' + serverVersion.version);
  db = createDataSource();
  await db.initialize();
  await db.runMigrations({ transaction: 'none' });
  ok(
    (await db.runMigrations({ transaction: 'none' })).length === 0,
    'all three migrations repeat safely',
  );
  const testPassword = randomBytes(24).toString('hex');
  const { passwordHash } = require('../apps/api/dist/auth/password.js');
  const credential = await passwordHash(testPassword);
  const actor = randomUUID(),
    scorer = randomUUID();
  for (const [id, role] of [
    [actor, 'admin'],
    [scorer, 'scorer'],
  ])
    await db.query(
      'INSERT INTO smc_users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(3))',
      [id, 'Import test', id + '@example.test', credential, role],
    );
  const service = new ImportBatches(db);
  const synthetic = fixture();
  for (const stat of synthetic.team_stats)
    stat.private_note = 'private import metadata';
  const sourcePath = process.argv.slice(2).find((a) => a !== '--browser');
  const bytes = sourcePath
    ? await readFile(sourcePath)
    : Buffer.from(sql(synthetic));
  const sourceHash = createHash('sha256').update(bytes).digest('hex'),
    tables = parseLegacy(bytes.toString('utf8')),
    plan = buildPlan(tables, sourceHash);
  await assert.rejects(() => service.stage(scorer, tables, sourceHash));
  ok(true, 'scorer cannot stage or resolve imports');
  const [a, b] = await Promise.all([
    service.stage(actor, tables, sourceHash),
    service.stage(actor, tables, sourceHash),
  ]);
  ok(
    a.batchId === b.batchId && [a, b].filter((x) => x.reused).length === 1,
    'concurrent staging creates one batch',
  );
  const report = await service.report(actor, a.batchId);
  ok(
    report.rows === plan.totalRows &&
      report.pendingStatistics.length === tables.team_stats.length,
    'all original records and unresolved statistics retained',
  );
  const config = {
    name: 'Ensayo aislado de edición actual',
    timezone: 'America/Managua',
    statisticsPolicy: 'reviewed-initial',
  };
  await assert.rejects(
    () => service.promote(actor, a.batchId, config),
    /decisión explícita/,
  );
  ok(
    (await db.query('SELECT id FROM smc_seasons')).length === 0 &&
      (await service.report(actor, a.batchId)).status === 'failed',
    'unresolved promotion records failure and creates no sports data',
  );
  const decisions = tables.team_stats.map((s) => ({
    sourceTeamId: s.team_id,
    expectedRevision: 0,
    mode: 'preserve',
    reason:
      'Ensayo técnico aislado: conservar originales; no constituye aprobación operativa.',
  }));
  const sourceFile = join(dir, 'source.sql');
  await writeFile(sourceFile, bytes, { mode: 0o600 });
  const decisionFile = join(dir, 'decisions.json');
  await writeFile(decisionFile, JSON.stringify(decisions), { mode: 0o600 });
  const cli = (args) =>
    JSON.parse(
      command(
        process.execPath,
        ['apps/api/dist/imports/batch-cli.js', ...args],
        env,
      ),
    );
  const retry = cli(['stage', sourceFile, '--actor', actor]);
  ok(
    retry.reused && retry.status === 'staged',
    'CLI reuses failed batch without inserting duplicate records',
  );
  cli(['decide', a.batchId, '--actor', actor, '--decisions', decisionFile]);
  await assert.rejects(
    () => service.decide(actor, a.batchId, [decisions[0]]),
    /revisión/,
  );
  ok(true, 'stale decisions cannot overwrite audited resolutions');
  const first = decisions[0];
  await assert.rejects(
    () =>
      service.decide(actor, a.batchId, [
        {
          ...first,
          expectedRevision: 1,
          reason: 'Revisión válida sin pérdida de origen.',
        },
        { ...decisions[1], expectedRevision: 99 },
      ]),
    /revisión/,
  );
  ok(
    (
      await db.query(
        'SELECT * FROM smc_import_decisions WHERE source_team_id=?',
        [first.sourceTeamId],
      )
    ).length === 1,
    'multi-decision conflict rolls back the entire file',
  );
  // Inject a real SQL error without requiring trigger/SUPER privileges on either engine.
  const originalRunner = db.createQueryRunner.bind(db);
  db.createQueryRunner = (...args) => {
    const runner = originalRunner(...args),
      query = runner.query.bind(runner);
    runner.query = (sql, ...values) =>
      /^INSERT INTO smc_matches\b/i.test(sql)
        ? query('SELECT * FROM smc_injected_missing_table')
        : query(sql, ...values);
    return runner;
  };
  try {
    await assert.rejects(() => service.promote(actor, a.batchId, config));
  } finally {
    db.createQueryRunner = originalRunner;
  }
  ok(
    (await db.query('SELECT id FROM smc_teams')).length === 0 &&
      (await db.query('SELECT * FROM smc_legacy_mappings')).length === 0,
    'mid-promotion database failure rolls back teams, season and mappings',
  );
  const configFile = join(dir, 'config.json');
  await writeFile(configFile, JSON.stringify(config));
  const promoted = cli([
    'promote',
    a.batchId,
    '--actor',
    actor,
    '--config',
    configFile,
  ]);
  const repeated = await service.promote(actor, a.batchId, config);
  ok(
    promoted.seasonId === repeated.seasonId && repeated.reused,
    'promotion retry returns original season without duplication',
  );
  const verified = await service.report(actor, a.batchId);
  ok(
    verified.status === 'promoted' &&
      verified.rows === plan.totalRows &&
      !verified.pendingStatistics.length,
    'post-import verification checks all source rows and target links',
  );
  const [nativeTeams] = await pool.query('SELECT * FROM smc_teams');
  ok(
    nativeTeams.length === tables.teams.length &&
      tables.teams.every((t) => nativeTeams.some((n) => n.name === t.name)),
    'team IDs and exact Unicode names survive, including duplicate names',
  );
  const [stats] = await pool.query('SELECT * FROM smc_legacy_stats');
  ok(
    stats.length === tables.team_stats.length &&
      stats.every((s) =>
        isDeepStrictEqual(
          typeof s.original_values === 'string'
            ? JSON.parse(s.original_values)
            : s.original_values,
          tables.team_stats.find((t) => t.team_id === s.source_team_id),
        ),
      ),
    'all statistics snapshots preserve every original value',
  );
  const [matches] = await pool.query('SELECT * FROM smc_matches');
  ok(
    matches.length === tables.games.length &&
      matches.every(
        (m) =>
          m.scheduled_at === null &&
          m.clock_started_at === null &&
          m.home_score === 0 &&
          m.away_score === 0,
      ),
    'all source fixtures retained without invented schedules or running clocks',
  );
  const [competitions] = await pool.query(
    'SELECT c.*,k.slug FROM smc_competitions c JOIN smc_categories k ON k.id=c.category_id',
  );
  ok(
    competitions.length === 4 &&
      competitions.every(
        (c) =>
          !c.published &&
          !c.rules_confirmed &&
          c.group_capacity >=
            plan.competitions.find((p) => p.slug === c.slug)
              .minimumGroupCapacity,
      ),
    'four independent draft competitions use imported capacity without confirming rules',
  );
  const [groups] = await pool.query(
    'SELECT c.id,c.category_id,g.name,COUNT(ge.id) AS n FROM smc_competitions c JOIN smc_groups g ON g.competition_id=c.id LEFT JOIN smc_group_entries ge ON ge.group_id=g.id GROUP BY c.id,c.category_id,g.name',
  );
  ok(
    groups.length === 8 &&
      groups.every(
        (g) =>
          Number(g.n) ===
          plan.competitions.find(
            (p) => p.slug === competitions.find((c) => c.id === g.id).slug,
          ).knownGroupSizes[g.name],
      ),
    'all ten source groups map to the eight confirmed A/B groups',
  );
  await assert.rejects(
    () => service.decide(actor, a.batchId, [{ ...first, expectedRevision: 1 }]),
    /inmutable/,
  );
  ok(true, 'promoted review decisions are immutable');
  await assert.rejects(
    () => service.promote(actor, a.batchId, { ...config, name: 'Other name' }),
    /otra configuración/,
  );
  ok(true, 'changed retry configuration is rejected');
  const altered = structuredClone(tables);
  altered.teams[0].name += ' changed';
  await assert.rejects(
    () => service.stage(actor, altered, sourceHash),
    /contenido/,
  );
  ok(true, 'same source hash cannot silently change staged rows');
  const output = join(dir, 'report.json');
  cli(['report', a.batchId, '--actor', actor, '--out', output]);
  ok(
    ((await stat(output)).mode & 0o777) === 0o600,
    'CLI reports are private and refuse overwrites',
  );
  assert.throws(() =>
    cli(['report', a.batchId, '--actor', actor, '--out', output]),
  );
  const { standingRows } = require('../apps/api/dist/sports/queries.js');
  const { standings } = require('../apps/api/dist/sports/rules.js');
  const { SportsStore } = require('../apps/api/dist/sports/store.js');
  const {
    CompetitionService,
  } = require('../apps/api/dist/sports/competition.service.js');
  const sportsStore = new SportsStore({
    transaction: (fn) => db.transaction('READ COMMITTED', fn),
  });
  const sports = new CompetitionService(sportsStore);
  const importedComp = competitions[0];
  const principal = { id: actor, role: 'admin', version: 0 };
  const fixtureIds = matches.map((m) => m.id).sort();
  await assert.rejects(
    () =>
      sports.importedPublication(principal, competitions[1].id, randomUUID(), {
        expectedVersion: 0,
        published: true,
        reason: 'Publicación revisada para ensayo.',
      }),
    /reglas/,
  );
  ok(true, 'import publication requires confirmed rules');

  await db.query('UPDATE smc_competitions SET rules_confirmed=1 WHERE id=?', [
    importedComp.id,
  ]);
  await assert.rejects(
    () =>
      sports.preview(
        { id: actor, role: 'admin', version: 0 },
        importedComp.id,
        { mode: 'manual', entryIds: [] },
      ),
    /importados/,
  );
  ok(
    true,
    'a new draw cannot erase imported group membership or fixture provenance',
  );
  const firstMatch = matches[0],
    rule = competitions.find((c) => c.id === firstMatch.competition_id);
  const rows = await standingRows(db.manager, rule.id);
  const {
    PublicSportsService,
  } = require('../apps/api/dist/sports/public.service.js');
  const publicApi = new PublicSportsService({
    snapshot: (fn) => db.transaction('REPEATABLE READ', fn),
  });
  await assert.rejects(() => publicApi.table(rule.id, false));
  ok(true, 'unpublished imported competition is absent from public standings');
  await db.query('UPDATE smc_competitions SET rules_confirmed=1 WHERE id=?', [
    rule.id,
  ]);
  const pubKey = randomUUID(),
    pubBody = {
      expectedVersion: 0,
      published: true,
      reason: 'Publicación de datos importados revisados.',
    };
  const pub = await sports.importedPublication(
    principal,
    rule.id,
    pubKey,
    pubBody,
  );
  const replay = await sports.importedPublication(
    principal,
    rule.id,
    pubKey,
    pubBody,
  );
  ok(
    pub.data.version === 1 && isDeepStrictEqual(pub, replay),
    'import publication retry returns its original response',
  );
  await assert.rejects(
    () => sports.importedPublication(principal, rule.id, randomUUID(), pubBody),
    /cambió/,
  );
  await assert.rejects(
    () =>
      sports.importedPublication(principal, rule.id, pubKey, {
        ...pubBody,
        published: false,
      }),
    /otros datos/,
  );
  ok(
    true,
    'publication rejects stale versions and reused keys with changed payloads',
  );
  ok(
    JSON.stringify(
      (await db.query('SELECT id FROM smc_matches')).map((m) => m.id).sort(),
    ) === JSON.stringify(fixtureIds),
    'publication preserves all imported fixture IDs',
  );
  const publicInitial = await publicApi.table(rule.id, false);
  ok(
    publicInitial.mode === 'official' &&
      publicInitial.data.every(
        (row) =>
          row.baseline &&
          row.data_origin === 'reviewed_initial_plus_native' &&
          !JSON.stringify(row).includes('private import metadata'),
      ),
    'public standings expose reviewed baseline provenance without actor or private decisions',
  );
  await db.query('UPDATE smc_seasons SET active=1 WHERE id=?', [
    rule.season_id,
  ]);
  const landingInitial = await publicApi.site();
  const landingCompetition = landingInitial.competitions.find(
    (c) => c.id === rule.id,
  );
  ok(
    landingCompetition.standings.every((r) =>
      publicInitial.data.some(
        (o) =>
          o.id === r.id &&
          o.points === r.points &&
          o.gf === r.gf &&
          o.gd === r.gd,
      ),
    ) && !JSON.stringify(landingInitial).includes('chosen_values'),
    'landing receives reviewed imported statistics without exposing reconciliation decisions',
  );
  const initial = standings(rows, [], rule).find(
    (r) => r.id === firstMatch.home_entry_id,
  );
  ok(
    initial.baseline && initial.data_origin === 'reviewed_initial_plus_native',
    'initial statistics loaded from reviewed snapshots by exact entry',
  );
  await db.query(
    "UPDATE smc_matches SET status='finished',confirmed=1,home_score=2,away_score=1 WHERE id=?",
    [firstMatch.id],
  );
  const updated = standings(
    await standingRows(db.manager, rule.id),
    await db.query('SELECT * FROM smc_matches WHERE competition_id=?', [
      rule.id,
    ]),
    rule,
  ).find((r) => r.id === firstMatch.home_entry_id);
  ok(
    updated.played === initial.played + 1 &&
      updated.wins === initial.wins + 1 &&
      updated.gd === initial.gd + 1 &&
      updated.points === initial.points + rule.win_points,
    'a newly confirmed result adds to the initial baseline exactly once',
  );
  await db.query('UPDATE smc_matches SET confirmed=0 WHERE id=?', [
    firstMatch.id,
  ]);
  const reopened = standings(
    await standingRows(db.manager, rule.id),
    await db.query('SELECT * FROM smc_matches WHERE competition_id=?', [
      rule.id,
    ]),
    rule,
  ).find((r) => r.id === firstMatch.home_entry_id);
  ok(
    reopened.points === initial.points && reopened.gd === initial.gd,
    'reopening removes only the native contribution and preserves the baseline',
  );
  const hidden = await sports.importedPublication(
    principal,
    rule.id,
    randomUUID(),
    {
      expectedVersion: 1,
      published: false,
      reason: 'Retiro temporal sin borrar fixtures.',
    },
  );
  await assert.rejects(() => publicApi.table(rule.id, false));
  ok(
    hidden.data.version === 2 &&
      (await db.query('SELECT * FROM smc_matches')).length === matches.length,
    'hiding an import removes public visibility without deleting games',
  );
  const landingHidden = await publicApi.site();
  ok(
    !landingHidden.competitions.some((c) => c.id === rule.id) &&
      !landingHidden.matches.some((m) => m.competitionId === rule.id),
    'hiding an imported competition also removes it from the landing projection',
  );
  const [missingSnapshot] = await db.query(
    'SELECT * FROM smc_legacy_stats WHERE entry_id=?',
    [firstMatch.home_entry_id],
  );
  await db.query('DELETE FROM smc_legacy_stats WHERE id=?', [
    missingSnapshot.id,
  ]);
  await assert.rejects(
    () =>
      sports.importedPublication(principal, rule.id, randomUUID(), {
        expectedVersion: 2,
        published: true,
        reason: 'Verificación de snapshots completos.',
      }),
    /estadísticas/,
  );
  await db.query(
    'INSERT INTO smc_legacy_stats(id,batch_id,source_team_id,team_id,entry_id,original_values,reviewed_values,decision_id) VALUES (?,?,?,?,?,?,?,?)',
    [
      missingSnapshot.id,
      missingSnapshot.batch_id,
      missingSnapshot.source_team_id,
      missingSnapshot.team_id,
      missingSnapshot.entry_id,
      typeof missingSnapshot.original_values === 'string'
        ? missingSnapshot.original_values
        : JSON.stringify(missingSnapshot.original_values),
      typeof missingSnapshot.reviewed_values === 'string'
        ? missingSnapshot.reviewed_values
        : JSON.stringify(missingSnapshot.reviewed_values),
      missingSnapshot.decision_id,
    ],
  );
  ok(true, 'publication refuses a missing initial-statistics snapshot');
  if (process.argv.includes('--browser')) {
    const { createServer } = await import('node:net');
    const apiPort = await new Promise((resolve) => {
      const s = createServer();
      s.listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });
    const apiEnv = {
      ...env,
      PORT: String(apiPort),
      APP_ORIGIN: 'http://127.0.0.1:5173',
      CSRF_SECRET: randomBytes(32).toString('hex'),
      SMTP_HOST: '',
      PUBLIC_DATA_SOURCE: 'system',
    };
    app = spawn(process.execPath, ['apps/api/dist/main.js'], {
      env: apiEnv,
      stdio: 'ignore',
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if (
          (await fetch(`http://127.0.0.1:${apiPort}/api/v1/health/live`)).ok
        ) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    ok(ready, 'isolated imported API starts for publication browser test');
    ok(
      (await fetch(`http://127.0.0.1:${apiPort}/api/v1/health/ready`)).ok,
      'prepared database passes deployment readiness',
    );
    console.log(
      command('npm', ['run', 'test:e2e', '--', 'imports.e2e.ts'], {
        ...apiEnv,
        API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
        SMC_IMPORT_TEST: '1',
        SMC_TEST_EMAIL: actor + '@example.test',
        SMC_TEST_PASSWORD: testPassword,
        SMC_IMPORT_COMPETITION: rule.id,
        SMC_IMPORT_SEASON: promoted.seasonId,
        SMC_IMPORT_FIXTURE_COUNT: String(
          matches.filter((m) => m.competition_id === rule.id).length,
        ),
      }),
    );
  }
  const backup = await backupIsolated(name, join(dir, 'backup'));
  ok(
    ((await stat(backup.file)).mode & 0o777) === 0o600,
    'isolated backup and manifest are created privately',
  );
  restoreName = 'smoky-import-test-' + randomBytes(5).toString('hex');
  command(
    'docker',
    [
      'run',
      '--detach',
      '--rm',
      '--name',
      restoreName,
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
  const restorePort = Number(
    command('docker', ['port', restoreName, '3306/tcp']).split(':').at(-1),
  );
  restorePool = createPool({
    host: '127.0.0.1',
    port: restorePort,
    user: 'smoky_test',
    password,
    database,
  });
  let restoredReady = false;
  for (let i = 0; i < 600; i++) {
    try {
      await restorePool.query('SELECT 1');
      restoredReady = true;
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  ok(
    restoredReady,
    `separate empty ${engine.image} is ready for restoration rehearsal`,
  );
  await restoreIsolated(restoreName, backup.file, backup.manifest);
  const [sourceTables] = await pool.query('SHOW TABLES');
  for (const item of sourceTables) {
    const table = Object.values(item)[0];
    assert.match(table, /^smc_[a-z_]+$/);
    const [[source]] = await pool.query(
      'SELECT COUNT(*) n FROM `' + table + '`',
    );
    const [[restored]] = await restorePool.query(
      'SELECT COUNT(*) n FROM `' + table + '`',
    );
    assert.equal(Number(restored.n), Number(source.n));
  }
  ok(true, 'backup restoration preserves row counts of every system table');
  const [restoredStats] = await restorePool.query(
    'SELECT * FROM smc_legacy_stats ORDER BY source_team_id',
  );
  const [sourceStats] = await pool.query(
    'SELECT * FROM smc_legacy_stats ORDER BY source_team_id',
  );
  ok(
    JSON.stringify(restoredStats) === JSON.stringify(sourceStats),
    'restored baseline snapshots and decision links are unchanged',
  );
  await assert.rejects(
    () => restoreIsolated(restoreName, backup.file, backup.manifest),
    /vacío/,
  );
  ok(true, 'restore refuses a populated target');
  const [[record]] = await pool.query(
    'SELECT * FROM smc_legacy_records LIMIT 1',
  );
  await pool.query(
    'UPDATE smc_legacy_records SET payload_hash=? WHERE batch_id=? AND source_table=? AND row_no=?',
    ['0'.repeat(64), record.batch_id, record.source_table, record.row_no],
  );
  await assert.rejects(() => service.report(actor, a.batchId), /integridad/);
  ok(true, 'verification detects altered original-row checksum');
  const [currentComp] = await db.query(
    'SELECT version FROM smc_competitions WHERE id=?',
    [rule.id],
  );
  await assert.rejects(
    () =>
      sports.importedPublication(principal, rule.id, randomUUID(), {
        expectedVersion: currentComp.version,
        published: true,
        reason: 'Verificación de integridad antes de publicar.',
      }),
    /integridad/,
  );
  ok(true, 'publication refuses a corrupted source snapshot');
  ok(
    createHash('sha256')
      .update(await readFile(sourceFile))
      .digest('hex') === sourceHash,
    'input SQL never changes and is never executed',
  );
  console.log(
    JSON.stringify({
      checks,
      sourceSha256: sourceHash,
      sourceRows: plan.totalRows,
      teams: tables.teams.length,
      matches: tables.games.length,
      statistics: tables.team_stats.length,
      isolated: true,
      productionChanged: false,
    }),
  );
} finally {
  app?.kill();
  await restorePool?.end();
  if (restoreName) command('docker', ['rm', '--force', restoreName]);
  if (db?.isInitialized) await db.destroy();
  await pool?.end();
  if (started) command('docker', ['rm', '--force', name]);
  await rm(dir, { recursive: true, force: true });
}
