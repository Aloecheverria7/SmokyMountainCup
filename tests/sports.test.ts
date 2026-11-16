import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonical,
  elapsed,
  knockoutPairs,
  standings,
} from '../apps/api/src/sports/rules';
import { scheduleOptions } from '../apps/web/src/admin/time';
test('all knockout sizes preserve entrants and correct bye count', () => {
  for (let n = 2; n <= 512; n++) {
    const ids = Array.from({ length: n }, (_, i) => String(i));
    const pairs = knockoutPairs(ids);
    assert.deepEqual(pairs.flat().filter(Boolean).sort(), [...ids].sort());
    assert.equal(
      pairs.filter((p) => p[1] === null).length,
      pairs.length * 2 - n,
    );
  }
  assert.throws(() => knockoutPairs(['1', '1']));
});
test('canonical payload hash is insensitive to object key order but preserves ordered seeds', () => {
  assert.equal(canonical({ b: [1, 2], a: 3 }), canonical({ a: 3, b: [1, 2] }));
  assert.notEqual(canonical([1, 2]), canonical([2, 1]));
});
test('clock adds only live elapsed server time and clamps future start', () => {
  const at = Date.parse('2026-01-01T12:01:30Z');
  const m = {
    elapsed_seconds: 120,
    clock_started_at: '2026-01-01 12:00:00',
    status: 'live',
  };
  assert.equal(elapsed(m, at), 210);
  assert.equal(elapsed(m, at - 120000), 120);
  for (const status of [
    'paused',
    'half_time',
    'suspended',
    'finished',
    'scheduled',
  ])
    assert.equal(elapsed({ ...m, status }, at), 120);
});
test('official table excludes unconfirmed results; provisional includes paused games', () => {
  const entries = [
    { id: '1', name: 'A', group_name: 'A' },
    { id: '2', name: 'B', group_name: 'A' },
  ];
  const match = {
    stage: 'group',
    home_entry_id: '1',
    away_entry_id: '2',
    home_score: 2,
    away_score: 1,
    status: 'paused',
    confirmed: false,
  };
  const rules = { win_points: 3, draw_points: 1, loss_points: 0 };
  assert.equal(standings(entries, [match], rules)[0].points, 0);
  assert.equal(standings(entries, [match], rules, true)[0].points, 3);
  assert.equal(
    standings(entries, [{ ...match, status: 'suspended' }], rules, true)[0]
      .played,
    0,
  );
});
test('scheduling rejects nonexistent DST time and offers explicit ambiguous offsets', () => {
  assert.throws(() => scheduleOptions('2027-03-14T02:30', 'America/New_York'));
  const options = scheduleOptions('2027-11-07T01:30', 'America/New_York');
  assert.equal(options.length, 2);
  assert.notEqual(options[0].value, options[1].value);
  assert.equal(
    scheduleOptions('2027-01-01T10:00', 'America/New_York')[0].value,
    '2027-01-01T15:00:00.000Z',
  );
});
