export function StandingsTable({
  rows,
  locale = 'es',
}: {
  rows: any[];
  locale?: 'en' | 'es';
}) {
  const groups = [...new Set(rows.map((r) => r.group_name))];
  return (
    <>
      {groups.map((name) => (
        <section key={name ?? 'all'}>
          <h3>
            {name
              ? (locale === 'en' ? 'Group ' : 'Grupo ') + name
              : locale === 'en'
                ? 'Teams'
                : 'Equipos'}
          </h3>
          <div className="cup-table-wrap">
            <table>
              <thead>
                <tr>
                  {(locale === 'en'
                    ? ['Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']
                    : ['Equipo', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'Pts']
                  ).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.group_name === name)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      {[
                        'played',
                        'wins',
                        'draws',
                        'losses',
                        'gf',
                        'ga',
                        'gd',
                        'points',
                      ].map((k) => (
                        <td key={k}>{r[k]}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
