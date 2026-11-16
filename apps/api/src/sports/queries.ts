import type { DbContext } from '../database/database.service';
import { dbDate, elapsed } from './rules';
export const matchSelect = `SELECT m.*,c.duration,c.published,c.season_id,c.category_id,k.name AS category,s.timezone,s.name AS season,s.archived,ht.name AS home,at.name AS away,f.name AS field,v.name AS venue,g.name AS group_name,a.user_id AS scorer_id FROM smc_matches m JOIN smc_competitions c ON c.id=m.competition_id JOIN smc_seasons s ON s.id=c.season_id JOIN smc_categories k ON k.id=c.category_id LEFT JOIN smc_entries he ON he.id=m.home_entry_id LEFT JOIN smc_entries ae ON ae.id=m.away_entry_id LEFT JOIN smc_teams ht ON ht.id=he.team_id LEFT JOIN smc_teams at ON at.id=ae.team_id LEFT JOIN smc_fields f ON f.id=m.field_id LEFT JOIN smc_venues v ON v.id=f.venue_id LEFT JOIN smc_groups g ON g.id=m.group_id LEFT JOIN smc_assignments a ON a.match_id=m.id`;
export function matchDto(m: any, staff = false) {
  return {
    id: m.id,
    competitionId: m.competition_id,
    category_id: m.category_id,
    category: m.category,
    seasonId: m.season_id,
    season: m.season,
    timezone: m.timezone,
    group_name: m.group_name,
    groupId: m.group_id,
    stage: m.stage,
    roundNo: m.round_no,
    positionNo: m.position_no,
    home: m.home ?? 'To be decided',
    away:
      m.away ?? (m.confirmed && !m.source_home_id ? 'BYE' : 'To be decided'),
    homeEntryId: m.home_entry_id,
    awayEntryId: m.away_entry_id,
    sourceHomeId: m.source_home_id,
    sourceAwayId: m.source_away_id,
    status: m.status,
    elapsed: elapsed(m),
    home_score: m.home_score,
    away_score: m.away_score,
    home_crest: null,
    away_crest: null,
    homePenalties: m.home_penalties,
    awayPenalties: m.away_penalties,
    confirmed: !!m.confirmed,
    winnerEntryId: m.winner_entry_id,
    scheduled_iso: m.scheduled_at ? dbDate(m.scheduled_at).toISOString() : null,
    field: m.field,
    venue: m.venue,
    updated_at: dbDate(m.updated_at)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19),
    version: m.version,
    ...(staff
      ? {
          fieldId: m.field_id,
          scorerId: m.scorer_id,
          archived: !!m.archived,
          duration: m.duration,
        }
      : {}),
  };
}
export async function standingRows(tx: DbContext, cid: string) {
  const rows = await tx.query(
    'SELECT e.id,e.team_id AS teamId,t.name,g.id AS group_id,g.name AS group_name,ls.reviewed_values AS baseline_values,ls.batch_id AS baseline_batch FROM smc_entries e JOIN smc_teams t ON t.id=e.team_id LEFT JOIN smc_group_entries ge ON ge.entry_id=e.id LEFT JOIN smc_groups g ON g.id=ge.group_id LEFT JOIN smc_legacy_stats ls ON ls.entry_id=e.id WHERE e.competition_id=?',
    [cid],
  );
  return rows.map((row: any) => {
    const { baseline_values, baseline_batch, ...entry } = row;
    return {
      ...entry,
      ...(baseline_values
        ? {
            baseline: {
              batchId: baseline_batch,
              values: Object.fromEntries(
                [
                  'games_played',
                  'wins',
                  'draws',
                  'losses',
                  'goals_scored',
                  'goals_conceded',
                  'goal_difference',
                  'points',
                ].map((key) => [
                  key,
                  Number(
                    (typeof baseline_values === 'string'
                      ? JSON.parse(baseline_values)
                      : baseline_values)[key],
                  ),
                ]),
              ),
            },
          }
        : {}),
    };
  });
}
export async function checkSchedule(
  tx: DbContext,
  match: any,
  fieldId: string | null,
  date: Date | null,
  duration: number,
) {
  if (!date) return;
  const start = date.getTime(),
    end = start + duration * 60000;
  const rows = await tx.query(
    `SELECT m.*,c.duration,he.team_id AS home_team,ae.team_id AS away_team FROM smc_matches m JOIN smc_competitions c ON c.id=m.competition_id LEFT JOIN smc_entries he ON he.id=m.home_entry_id LEFT JOIN smc_entries ae ON ae.id=m.away_entry_id WHERE m.id<>? AND m.scheduled_at IS NOT NULL AND m.status<>'suspended'`,
    [match.id],
  );
  const teams = await tx.query(
    'SELECT team_id FROM smc_entries WHERE id IN (?,?)',
    [match.home_entry_id, match.away_entry_id],
  );
  const ids = new Set(teams.map((e: any) => e.team_id));
  for (const other of rows) {
    const a = dbDate(other.scheduled_at).getTime(),
      b = a + other.duration * 60000;
    if (a >= end || b <= start) continue;
    if (fieldId && fieldId === other.field_id)
      throw new Error('FIELD_CONFLICT');
    if (ids.has(other.home_team) || ids.has(other.away_team))
      throw new Error('TEAM_CONFLICT');
  }
}
