import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  TABLES,
  DEFAULT_MAPPING,
  parseLegacy,
  inspectLegacy,
  buildPlan,
  validateMapping,
  type Tables,
} from '../apps/api/src/imports/legacy';
import { fixture, sql } from './fixtures/legacy';
test('literal parser preserves Unicode, quotes, embedded SQL-looking text and whitespace', () => {
  const rows = fixture();
  rows.teams[1].name = 'Muñecos de Papel — España';
  const parsed = parseLegacy(
    '-- Source dump\n' + sql(rows) + '\n/*!40101 SET NAMES utf8mb4 */;',
  );
  assert.deepEqual(parsed, rows);
  assert.equal(parsed.teams[0].name, "  O'Brien, (FC); INSERT INTO `teams`  ");
  assert.deepEqual(parsed.goals, []);
});
test('parser rejects expressions, unsupported data writes and truncated literals without executing SQL', () => {
  const base = sql(fixture());
  for (const extra of [
    "/*!50000 INSERT INTO `teams` (`id`,`name`) VALUES (999,'conditional') */;",
    'CREATE PROCEDURE test() BEGIN SELECT 1; END;',
    "INSERT INTO `teams` (`id`,`name`) VALUES (999,CONCAT('a','b'));",
    "UPDATE teams SET name='x';",
    'INSERT INTO `unknown` (`id`) VALUES (1);',
    "INSERT INTO `teams` (`id`,`name`) VALUES (999,'unfinished)",
  ]) {
    assert.throws(() => parseLegacy(base + '\n' + extra));
  }
});
test('MySQL escapes decode known literal escapes and reject unknown ones', () => {
  const base = sql(fixture());
  const parsed = parseLegacy(
    base +
      "\nINSERT INTO `teams` (`id`,`name`) VALUES (99,'O\\'Brien\\nFC\\\\Club');",
  );
  assert.equal(parsed.teams.at(-1)!.name, "O'Brien\nFC\\Club");
  assert.throws(() =>
    parseLegacy(
      base + "\nINSERT INTO `teams` (`id`,`name`) VALUES (99,'\\q');",
    ),
  );
});
test('inspection reports original arithmetic discrepancies and never rewrites values', () => {
  const rows = fixture(),
    before = JSON.stringify(rows);
  const result = inspectLegacy(rows);
  assert.ok(result.issues.some((i) => i.code === 'PLAYED_MISMATCH'));
  assert.ok(result.issues.some((i) => i.code === 'GOAL_DIFFERENCE_MISMATCH'));
  assert.ok(result.issues.some((i) => i.code === 'STATS_NOT_RECONSTRUCTIBLE'));
  assert.equal(result.reconciliation[0].original.goal_difference, 0);
  assert.equal(result.reconciliation[0].derived.goalDifferenceFromGoals, 3);
  assert.equal(result.reconciliation[0].resolution.status, 'pending');
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(result.duplicateTeamNames[0].sourceIds, [6, 7]);
});
test('orphan references, duplicate keys and unknown statuses block promotion', () => {
  const rows = fixture();
  rows.teams.push({ ...rows.teams[0] });
  rows.games[0].status = 'mystery';
  rows.group_teams[0].group_id = 999;
  const issues = inspectLegacy(rows).issues;
  for (const code of [
    'DUPLICATE_PRIMARY_KEY',
    'UNKNOWN_STATUS',
    'ORPHAN_REFERENCE',
  ])
    assert.ok(issues.some((i) => i.code === code && i.severity === 'blocker'));
});
test('confirmed group mappings preserve the edition and combine adult source groups by category', () => {
  const rows = fixture(),
    plan = buildPlan(rows, 'source-hash');
  assert.equal(plan.editionPolicy, 'continue-current');
  assert.equal(plan.archiveAutomatically, false);
  assert.equal(plan.changesDatabase, false);
  assert.equal(plan.mappingComplete, true);
  assert.equal(plan.canApply, false);
  assert.equal(
    plan.competitions.find((c) => c.slug === 'infantil')!.entries,
    4,
  );
  assert.equal(plan.competitions.find((c) => c.slug === 'junior')!.matches, 2);
  assert.equal(plan.competitions.find((c) => c.slug === 'adulto')!.entries, 8);
  assert.ok(!plan.issues.some((i) => i.code === 'TARGET_GROUP_PENDING'));
  assert.deepEqual(
    DEFAULT_MAPPING.groups.map((g) => g.targetGroup),
    ['A', 'A', 'B', 'B', 'A', 'B', 'A', 'B', 'A', 'B'],
  );
  assert.deepEqual(
    plan.competitions.find((c) => c.slug === 'adulto')!.knownGroupSizes,
    { A: 4, B: 4 },
  );
  const incomplete = structuredClone(DEFAULT_MAPPING);
  incomplete.groups[0].targetGroup = null;
  assert.equal(
    buildPlan(rows, 'source-hash', incomplete).mappingComplete,
    false,
  );
  assert.ok(
    plan.matches.every(
      (m) => m.scheduledAt === null && m.clockStartedAt === null,
    ),
  );
  assert.equal(plan.originalRecords.teams.length, 20);
});
test('explicit group mapping is deterministic, validated against source labels and never guesses a phase', () => {
  const mapping = structuredClone(DEFAULT_MAPPING);
  for (const g of mapping.groups)
    g.targetGroup = g.sourceGroupId % 2 ? 'A' : 'B';
  const rows = fixture();
  const a = buildPlan(rows, 'hash', mapping),
    b = buildPlan(rows, 'hash', mapping);
  assert.deepEqual(a, b);
  assert.equal(a.mappingComplete, true);
  assert.equal(a.canApply, false);
  mapping.groups[0].sourceGroupName = 'Other source';
  assert.ok(
    buildPlan(rows, 'hash', mapping).issues.some(
      (i) => i.code === 'UNMAPPED_SOURCE_GROUP',
    ),
  );
  assert.throws(() =>
    validateMapping({ ...mapping, editionPolicy: 'archive' }),
  );
  assert.throws(() =>
    validateMapping({
      ...mapping,
      groups: [mapping.groups[0], mapping.groups[0]],
    }),
  );
});
test('a cross-group source fixture requires review instead of invented group/knockout assignment', () => {
  const mapping = structuredClone(DEFAULT_MAPPING);
  for (const g of mapping.groups)
    g.targetGroup = g.sourceGroupId % 2 ? 'A' : 'B';
  const rows = fixture();
  rows.games[0].guest_team_id = 15;
  assert.ok(
    buildPlan(rows, 'hash', mapping).issues.some(
      (i) => i.code === 'CROSS_GROUP_MATCH_REVIEW',
    ),
  );
});
test('example profile stays consistent with the confirmed mapping, including all eight destination groups', () => {
  assert.deepEqual(
    JSON.parse(readFileSync('docs/migration-mapping.example.json', 'utf8')),
    DEFAULT_MAPPING,
  );
});
test('read-only CLI writes a private report, leaves the source intact and refuses overwrites', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'smoky-legacy-test-'));
  try {
    const file = join(dir, 'source.sql'),
      out = join(dir, 'report.json'),
      input = sql(fixture());
    await writeFile(file, input);
    const args = [
      '--import',
      'tsx',
      'apps/api/src/imports/cli.ts',
      'plan',
      file,
      '--out',
      out,
    ];
    const run = () =>
      spawnSync(process.execPath, args, {
        encoding: 'utf8',
        env: {
          ...process.env,
          APP_DB_HOST: '127.0.0.1',
          APP_DB_PORT: '1',
          APP_DB_NAME: 'must-not-connect',
        },
      });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).changesDatabase, false);
    assert.equal(await readFile(file, 'utf8'), input);
    const report = await readFile(out, 'utf8');
    assert.equal(JSON.parse(report).originalRecords.teams.length, 20);
    if (process.platform !== 'win32')
      assert.equal((await stat(out)).mode & 0o777, 0o600);
    assert.equal(run().status, 1);
    assert.equal(await readFile(out, 'utf8'), report);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
