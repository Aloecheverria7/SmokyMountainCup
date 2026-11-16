import {
  TABLES,
  DEFAULT_MAPPING,
  type Tables,
} from '../../apps/api/src/imports/legacy';
export function fixture(): Tables {
  const tables = Object.fromEntries(
    TABLES.map((t) => [t, []]),
  ) as unknown as Tables;
  tables.categories = [
    { id: 1, name: 'Categoria A' },
    { id: 2, name: 'Categoria B' },
    { id: 3, name: 'Femenil' },
    { id: 4, name: 'Juvenil' },
  ];
  tables.groups = DEFAULT_MAPPING.groups.map((g) => ({
    id: g.sourceGroupId,
    name: g.sourceGroupName,
    category_id: g.sourceCategoryId,
  }));
  for (let g = 1; g <= 10; g++)
    for (let n = 1; n <= 2; n++) {
      const id = (g - 1) * 2 + n;
      tables.teams.push({
        id,
        name:
          id === 6 || id === 7
            ? 'Galacticos'
            : id === 1
              ? "  O'Brien, (FC); INSERT INTO `teams`  "
              : 'Equipo ' + id,
      });
      tables.group_teams.push({ id, group_id: g, team_id: id });
      tables.team_stats.push({
        team_id: id,
        games_played: id === 1 ? 4 : 0,
        wins: id === 1 ? 1 : 0,
        draws: 0,
        losses: 0,
        goals_scored: id === 1 ? 5 : 0,
        goals_conceded: id === 1 ? 2 : 0,
        goal_difference: 0,
        points: id === 1 ? 3 : 0,
      });
    }
  for (let g = 7; g <= 10; g++)
    tables.games.push({
      id: g - 6,
      home_team_id: g * 2 - 1,
      guest_team_id: g * 2,
      home_score: 0,
      guest_score: 0,
      status: 'not started',
      current_minute: 0,
      last_update: '2024-07-27 09:58:31',
      field: 'C-2A',
    });
  return tables;
}
export function sql(t: Tables) {
  return TABLES.filter((table) => t[table].length)
    .map((table) => {
      const columns = Object.keys(t[table][0]);
      return (
        'INSERT INTO `' +
        table +
        '` (' +
        columns.map((c) => '`' + c + '`').join(',') +
        ') VALUES ' +
        t[table]
          .map(
            (row) =>
              '(' +
              columns
                .map((c) =>
                  typeof row[c] === 'string'
                    ? "'" +
                      String(row[c])
                        .replaceAll('\\', '\\\\')
                        .replaceAll("'", "''") +
                      "'"
                    : row[c] === null
                      ? 'NULL'
                      : row[c],
                )
                .join(',') +
              ')',
          )
          .join(',') +
        ';'
      );
    })
    .join('\n');
}
