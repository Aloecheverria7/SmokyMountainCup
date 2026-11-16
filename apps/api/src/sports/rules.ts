import { createHash } from 'node:crypto';
export const liveStates = ['live', 'half_time', 'paused'];
export const transitions: Record<string, string[]> = {
  scheduled: ['live', 'suspended'],
  live: ['half_time', 'paused', 'finished', 'suspended'],
  half_time: ['live', 'finished', 'suspended'],
  paused: ['live', 'finished', 'suspended'],
  suspended: ['live', 'finished'],
  finished: [],
};
export function dbDate(value: Date | string) {
  return value instanceof Date
    ? value
    : new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
}
export function elapsed(match: any, at = Date.now()) {
  return (
    Number(match.elapsed_seconds) +
    (match.status === 'live' && match.clock_started_at
      ? Math.max(
          0,
          Math.floor((at - dbDate(match.clock_started_at).getTime()) / 1000),
        )
      : 0)
  );
}
export function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export const fingerprint = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
export function knockoutPairs(ids: string[]) {
  if (ids.length < 2 || ids.length > 512 || new Set(ids).size !== ids.length)
    throw Error('Invalid knockout entries');
  let size = 2;
  while (size < ids.length) size *= 2;
  const byes = size - ids.length;
  let offset = 0;
  return Array.from(
    { length: size / 2 },
    (_, i) =>
      [ids[offset++], i < byes ? null : ids[offset++]] as [
        string,
        string | null,
      ],
  );
}
export const sportingRank = (a: any, b: any) =>
  b.points - a.points || b.gd - a.gd || b.gf - a.gf;
export function standings(
  entries: any[],
  matches: any[],
  rules: any,
  provisional = false,
) {
  const table = new Map(
    entries.map((e) => [
      e.id,
      {
        ...e,
        played: Number(e.baseline?.values.games_played ?? 0),
        wins: Number(e.baseline?.values.wins ?? 0),
        draws: Number(e.baseline?.values.draws ?? 0),
        losses: Number(e.baseline?.values.losses ?? 0),
        gf: Number(e.baseline?.values.goals_scored ?? 0),
        ga: Number(e.baseline?.values.goals_conceded ?? 0),
        gd: Number(e.baseline?.values.goal_difference ?? 0),
        points: Number(e.baseline?.values.points ?? 0),
        data_origin: e.baseline
          ? 'reviewed_initial_plus_native'
          : 'native_events',
      },
    ]),
  );
  for (const m of matches) {
    if (
      m.stage !== 'group' ||
      !(provisional
        ? [...liveStates, 'finished'].includes(m.status)
        : m.status === 'finished' && m.confirmed)
    )
      continue;
    for (const [id, gf, ga] of [
      [m.home_entry_id, m.home_score, m.away_score],
      [m.away_entry_id, m.away_score, m.home_score],
    ]) {
      const r = table.get(id);
      if (!r) continue;
      r.played++;
      r.gf += Number(gf);
      r.ga += Number(ga);
      r.gd += Number(gf) - Number(ga);
      const result = gf > ga ? 'wins' : gf === ga ? 'draws' : 'losses';
      r[result]++;
      r.points += Number(
        rules[
          gf > ga ? 'win_points' : gf === ga ? 'draw_points' : 'loss_points'
        ],
      );
    }
  }
  return [...table.values()].sort(
    (a, b) =>
      String(a.group_name ?? '').localeCompare(String(b.group_name ?? '')) ||
      sportingRank(a, b) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}
