import { useEffect, useState } from 'react';
import { MatchCard, type Match, type FeedState } from './live';
import { readPublic, usePublic } from './public-api';
import { StandingsTable } from './StandingsTable';
interface Season {
  id: string;
  name: string;
  active: number;
  archived: number;
}
export function Tournament({ feed }: { feed: FeedState }) {
  const native = feed.data?.data_origin === 'native';
  return native ? (
    <NativeTournament feed={feed} />
  ) : (
    <main id="main-content" className="cup-section">
      <p className="cup-eyebrow">SMOKY MOUNTAIN CUP</p>
      <h1>Tournament center</h1>
      <p className="cup-stale">
        Original tournament results. Schedules and scorers may be incomplete.
      </p>
      <div className="cup-match-grid">
        {feed.data?.matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
      {!feed.data?.matches.length && (
        <p className="cup-empty">
          The next competition will be published here. Check back for teams and
          fixtures.
        </p>
      )}
    </main>
  );
}
function NativeTournament({ feed }: { feed: FeedState }) {
  const search = new URLSearchParams(location.search),
    seasons = usePublic<{ data: Season[] }>('seasons');
  const sid = search.get('season') ?? seasons.data?.data[0]?.id ?? '';
  const competitions = usePublic<{ data: { id: string; name: string }[] }>(
    sid ? `seasons/${sid}/competitions` : null,
  );
  const cid = search.get('category') ?? competitions.data?.data[0]?.id ?? '';
  const view = ['fixtures', 'standings', 'bracket', 'scorers'].includes(
    search.get('view') ?? '',
  )
    ? search.get('view')!
    : 'standings';
  const base = `tournament.php?season=${sid}&category=${cid}`;
  return (
    <main id="main-content" className="cup-section">
      <p className="cup-eyebrow">SMOKY MOUNTAIN CUP</p>
      <h1>Tournament center</h1>
      <div className="cup-toolbar">
        <form method="get">
          <label>
            Season
            <select
              name="season"
              value={sid}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              {seasons.data?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.archived ? ' · Archive' : ''}
                </option>
              ))}
            </select>
          </label>
          <noscript>
            <button>Show season</button>
          </noscript>
        </form>
        <a href="tournament.php?view=fixtures">Current matchday ↗</a>
      </div>
      {(seasons.error || competitions.error) && (
        <p role="alert" className="cup-stale">
          {seasons.error || competitions.error}
        </p>
      )}
      <nav className="cup-tabs" aria-label="Categories">
        {competitions.data?.data.map((c) => (
          <a
            key={c.id}
            className={c.id === cid ? 'active' : ''}
            href={`tournament.php?season=${sid}&category=${c.id}&view=${view}`}
          >
            {c.name}
          </a>
        ))}
      </nav>
      {!cid ? (
        <p className="cup-empty">
          The next competition will be published here. Check back for teams and
          fixtures.
        </p>
      ) : (
        <>
          <nav className="cup-tabs" aria-label="Competition views">
            {Object.entries({
              standings: 'Groups & standings',
              fixtures: 'Fixtures & results',
              bracket: 'Knockout bracket',
              scorers: 'Top scorers',
            }).map(([key, label]) => (
              <a
                key={key}
                className={view === key ? 'active' : ''}
                href={`${base}&view=${key}`}
              >
                {label}
              </a>
            ))}
          </nav>
          {view === 'standings' ? (
            <PublicStandings
              key={cid}
              cid={cid}
              base={base}
              provisional={search.get('provisional') === '1'}
            />
          ) : view === 'fixtures' ? (
            <Fixtures
              key={cid + search.get('date') + search.get('status')}
              cid={cid}
              sid={sid}
              date={search.get('date') ?? ''}
              status={search.get('status') ?? ''}
              feed={feed}
            />
          ) : view === 'bracket' ? (
            <Bracket key={cid} cid={cid} />
          ) : (
            <Scorers key={cid} cid={cid} />
          )}
        </>
      )}
    </main>
  );
}
function PublicStandings({
  cid,
  base,
  provisional,
}: {
  cid: string;
  base: string;
  provisional: boolean;
}) {
  const data = usePublic<{ data: any[] }>(
    `competitions/${cid}/standings?mode=${provisional ? 'provisional' : 'official'}`,
    true,
  );
  return (
    <>
      <p>
        <a href={`${base}&view=standings`}>Official standings</a> ·{' '}
        <a href={`${base}&view=standings&provisional=1`}>
          Live provisional standings
        </a>
      </p>
      <p className="cup-muted">
        {provisional
          ? 'Provisional: includes ongoing and unconfirmed matches.'
          : 'Official: confirmed results only.'}
      </p>
      {data.error && (
        <p role="alert" className="cup-stale">
          {data.error}
        </p>
      )}
      {data.data && <StandingsTable rows={data.data.data} locale="en" />}
    </>
  );
}
function Fixtures({
  cid,
  sid,
  date,
  status,
  feed,
}: {
  cid: string;
  sid: string;
  date: string;
  status: string;
  feed: FeedState;
}) {
  const path = `competitions/${cid}/matches?limit=100${date ? '&date=' + encodeURIComponent(date) : ''}${status ? '&status=' + encodeURIComponent(status) : ''}`;
  const [rows, setRows] = useState<Match[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false;
    readPublic(path)
      .then((r) => {
        if (!disposed) {
          setRows(r.data);
          setCursor(r.page.nextCursor);
        }
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
    };
  }, [path]);
  const merged = new Map(rows.map((m) => [m.id, m]));
  for (const m of feed.data?.matches ?? [])
    if (m.competitionId === cid) merged.set(m.id, m);
  const visible = [...merged.values()].filter(
    (m) =>
      (!status || m.status === status) &&
      (!date ||
        (m.scheduled_iso &&
          new Intl.DateTimeFormat('en-CA', { timeZone: m.timezone }).format(
            new Date(m.scheduled_iso),
          ) === date)),
  );
  return (
    <>
      <form method="get" className="cup-toolbar">
        <input type="hidden" name="season" value={sid} />
        <input type="hidden" name="category" value={cid} />
        <input type="hidden" name="view" value="fixtures" />
        <label>
          Date
          <input type="date" name="date" defaultValue={date} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {[
              'scheduled',
              'live',
              'half_time',
              'paused',
              'finished',
              'suspended',
            ].map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <button>Filter</button>
      </form>
      {error && (
        <p role="alert" className="cup-stale">
          {error}
        </p>
      )}
      <div className="cup-match-grid">
        {visible.map((m) => (
          <MatchCard
            key={m.id}
            match={feed.data?.matches.find((l) => l.id === m.id) ?? m}
          />
        ))}
      </div>
      {!visible.length && !error && (
        <p className="cup-empty">Fixtures have not been published yet.</p>
      )}
      {cursor && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await readPublic(path + '&cursor=' + cursor);
              setRows((s) => [...s, ...r.data]);
              setCursor(r.page.nextCursor);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Show more matches
        </button>
      )}
    </>
  );
}
function Bracket({ cid }: { cid: string }) {
  const data = usePublic<{ data: (Match & { roundNo: number })[] }>(
    `competitions/${cid}/bracket`,
    true,
  );
  const rounds = [...new Set(data.data?.data.map((m) => m.roundNo) ?? [])];
  return (
    <>
      {data.error && <p role="alert">{data.error}</p>}
      <div className="cup-bracket">
        {rounds.map((round) => (
          <section className="cup-bracket-round" key={round}>
            <h2>Round {round}</h2>
            {data
              .data!.data.filter((m) => m.roundNo === round)
              .map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
          </section>
        ))}
      </div>
      {data.data && !rounds.length && (
        <p className="cup-empty">
          The knockout bracket has not been published.
        </p>
      )}
    </>
  );
}
function Scorers({ cid }: { cid: string }) {
  const data = usePublic<{
    data: {
      id: string;
      name: string;
      team: string;
      goals: number;
      number: number;
    }[];
  }>(`competitions/${cid}/scorers`, true);
  return (
    <>
      <h2>Top scorers</h2>
      {data.error && <p role="alert">{data.error}</p>}
      <div className="cup-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>Goals</th>
            </tr>
          </thead>
          <tbody>
            {data.data?.data.map((s) => (
              <tr key={s.id}>
                <td>
                  #{s.number} {s.name}
                </td>
                <td>{s.team}</td>
                <td>{s.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.data && !data.data.data.length && (
        <p className="cup-muted">
          No confirmed goals with an identified scorer yet.
        </p>
      )}
    </>
  );
}
