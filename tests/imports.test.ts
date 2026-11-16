import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireIsolatedTarget,
  chosenStats,
} from '../apps/api/src/imports/batches';
import { fixture } from './fixtures/legacy';
test('isolated import rejects production, remote hosts and ordinary databases before connecting', () => {
  const env = { NODE_ENV: 'test', LEGACY_IMPORT_ISOLATED: '1' };
  const target = {
    host: '127.0.0.1',
    database: 'smoky_import_test_0123456789',
  };
  requireIsolatedTarget(target, env);
  for (const [t, e] of [
    [{ ...target, host: 'database.internal' }, env],
    [{ ...target, database: 'smoky_production' }, env],
    [target, { ...env, NODE_ENV: 'production' }],
    [target, { NODE_ENV: 'test' }],
  ] as const)
    assert.throws(() => requireIsolatedTarget(t, e));
});
test('statistics preservation is exact and correction requires complete consistent values and a reason', () => {
  const row = fixture().team_stats[0];
  const d = {
    sourceTeamId: 1,
    expectedRevision: 0,
    mode: 'preserve' as const,
    reason: 'Conservar snapshot para revisión documentada.',
  };
  assert.deepEqual(chosenStats(row, d), row);
  assert.throws(() => chosenStats(row, { ...d, reason: 'sí' }));
  assert.throws(() => chosenStats(row, { ...d, values: { points: 3 } }));
  const values = {
    games_played: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    goals_scored: 5,
    goals_conceded: 2,
    goal_difference: 3,
    points: 3,
  };
  const corrected = chosenStats(row, { ...d, mode: 'correct', values });
  assert.equal(corrected.games_played, 1);
  assert.equal(row.games_played, 4);
  assert.throws(() =>
    chosenStats(row, {
      ...d,
      mode: 'correct',
      values: { ...values, goal_difference: 99 },
    }),
  );
  assert.throws(() =>
    chosenStats(row, {
      ...d,
      mode: 'correct',
      values: { ...values, points: 1.5 },
    }),
  );
});

test('reviewed initial statistics add only new results and preserve original arithmetic discrepancies', async () => {
  const { standings } = await import('../apps/api/src/sports/rules');
  const base = {
    games_played: 4,
    wins: 1,
    draws: 0,
    losses: 0,
    goals_scored: 5,
    goals_conceded: 2,
    goal_difference: 99,
    points: 8,
  };
  const entries = [
    {
      id: 'home',
      name: 'Same',
      group_name: 'A',
      baseline: { batchId: 'batch', values: base },
    },
    { id: 'away', name: 'Same', group_name: 'A' },
  ];
  const match = {
    stage: 'group',
    status: 'finished',
    confirmed: true,
    home_entry_id: 'home',
    away_entry_id: 'away',
    home_score: 2,
    away_score: 1,
  };
  const rules = { win_points: 3, draw_points: 1, loss_points: 0 };
  const row = standings(entries, [match], rules).find((r) => r.id === 'home')!;
  assert.deepEqual(
    [
      row.played,
      row.wins,
      row.draws,
      row.losses,
      row.gf,
      row.ga,
      row.gd,
      row.points,
    ],
    [5, 2, 0, 0, 7, 3, 100, 11],
  );
  assert.equal(row.data_origin, 'reviewed_initial_plus_native');
  const reopened = { ...match, confirmed: false };
  assert.equal(
    standings(entries, [reopened], rules).find((r) => r.id === 'home')!.gd,
    99,
  );
  assert.equal(
    standings(entries, [reopened], rules, true).find((r) => r.id === 'home')!
      .gd,
    100,
  );
  assert.equal(base.goal_difference, 99);
});

test('managed hosting configuration rejects ambiguous proxy trust and invalid bindings', async () => {
  const { hostingOptions } = await import('../apps/api/src/web-hosting');
  assert.deepEqual(hostingOptions({}), {
    host: '127.0.0.1',
    proxy: 0,
    serveWeb: false,
  });
  assert.deepEqual(
    hostingOptions({
      LISTEN_HOST: '0.0.0.0',
      TRUST_PROXY_HOPS: '1',
      SERVE_WEB: '1',
    }),
    { host: '0.0.0.0', proxy: 1, serveWeb: true },
  );
  for (const env of [
    { TRUST_PROXY_HOPS: 'true' },
    { TRUST_PROXY_HOPS: '1.5' },
    { LISTEN_HOST: 'example.test' },
    { SERVE_WEB: 'yes' },
  ])
    assert.throws(() => hostingOptions(env));
});
