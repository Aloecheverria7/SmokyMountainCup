import {
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  attributesToProps,
  domToReact,
  Element,
  type DOMNode,
} from 'html-react-parser';
import { usePublic } from '../public-api';
import type { Match } from '../live';
export interface SiteMatch extends Match {
  id: string;
  competitionId: string;
  homeEntryId: string | null;
  awayEntryId: string | null;
  season: string;
  venue: string | null;
  confirmed: boolean;
  homePenalties: number | null;
  awayPenalties: number | null;
}
export interface SitePlayer {
  id: string;
  rosterId: string;
  name: string;
  number: number;
  entryId: string;
  team: string;
  competitionId: string;
  category: string;
  group_name: string | null;
  goals: number;
  ownGoals: number;
}
export interface SiteStanding {
  id: string;
  teamId: string;
  name: string;
  groupId: string | null;
  group: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}
export interface SiteData {
  season: { id: string; name: string; timezone: string } | null;
  competitions: {
    id: string;
    name: string;
    slug: string;
    groups: { id: string; name: string }[];
    standings: SiteStanding[];
  }[];
  matches: SiteMatch[];
  players: SitePlayer[];
}
const Sports = createContext<{
  data: SiteData | null;
  error: string;
  ready: boolean;
}>({ data: null, error: '', ready: false });
export function PublishedSportsProvider({ children }: { children: ReactNode }) {
  const state = usePublic<SiteData>('site', true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const loaded = () => setReady(true);
    if (document.documentElement.dataset.publishedReady === 'true') loaded();
    window.addEventListener('smc-published-ready', loaded);
    return () => window.removeEventListener('smc-published-ready', loaded);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.sportsState = state.error
      ? state.data
        ? 'stale'
        : 'error'
      : state.data
        ? 'ready'
        : 'loading';
  }, [state.data, state.error, ready]);
  const layoutKey = JSON.stringify([
    state.data?.matches.length,
    state.data?.players.length,
    state.data?.competitions.map((c) => c.standings.length),
  ]);
  useEffect(() => {
    if (ready) window.dispatchEvent(new Event('resize'));
  }, [ready, layoutKey]);
  return (
    <Sports.Provider value={{ data: state.data, error: state.error, ready }}>
      {children}
    </Sports.Provider>
  );
}
const query = () => new URLSearchParams(location.search);
function useSports() {
  const state = useContext(Sports),
    q = query();
  const cid = q.get('competition'),
    group = q.get('group');
  const competitions = (state.data?.competitions ?? []).filter(
    (c) => !cid || c.id === cid || c.slug === cid,
  );
  const ids = new Set(competitions.map((c) => c.id));
  const selectedDate = q.get('date');
  const matches = (state.data?.matches ?? []).filter(
    (m) =>
      ids.has(m.competitionId) &&
      (!group || m.group_name === group) &&
      (!selectedDate ||
        (m.scheduled_iso &&
          new Intl.DateTimeFormat('en-CA', {
            timeZone: m.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(m.scheduled_iso)) === selectedDate)),
  );
  const players = (state.data?.players ?? []).filter(
    (p) => ids.has(p.competitionId) && (!group || p.group_name === group),
  );
  const id = q.get('id');
  return {
    ...state,
    competitions,
    matches,
    players,
    selected: id ? matches.find((m) => m.id === id) : undefined,
    message: state.error
      ? state.data
        ? 'Results temporarily unavailable. Showing the last received update.'
        : 'Results temporarily unavailable.'
      : state.data
        ? 'No published data available.'
        : 'Loading results…',
  };
}
const props = (n: Element) => attributesToProps(n.attribs);
const classes = (n: Element) => n.attribs.class?.split(/\s+/) || [];
const has = (n: Element, c: string) => classes(n).includes(c);
const text = (n: DOMNode): string =>
  n.type === 'text'
    ? n.data
    : 'children' in n
      ? (n.children as DOMNode[]).map(text).join('')
      : '';
function matchLink(m: SiteMatch, path = 'games-details.php') {
  return `/${path}?id=${encodeURIComponent(m.id)}&competition=${m.competitionId}`;
}
function playerLink(p: SitePlayer, path = 'player-details.php') {
  return `/${path}?player=${p.id}&competition=${p.competitionId}`;
}
function date(m: SiteMatch | undefined, part: 'date' | 'time' = 'date') {
  if (!m?.scheduled_iso) return 'To be scheduled';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: m.timezone,
    ...(part === 'date'
      ? ({ month: 'long', day: 'numeric', year: 'numeric' } as const)
      : ({ hour: 'numeric', minute: '2-digit' } as const)),
  }).format(new Date(m.scheduled_iso));
}
function score(m: SiteMatch) {
  return m.status === 'scheduled'
    ? 'VS'
    : `${m.home_score} – ${m.away_score}${m.homePenalties !== null ? ` (${m.homePenalties}–${m.awayPenalties} pens)` : ''}${m.confirmed ? '' : m.status === 'finished' ? ' · Unconfirmed' : ' · ' + m.status.replace('_', ' ')}`;
}
function label(m: SiteMatch) {
  return `${m.category}${m.group_name ? ' · ' + m.group_name : ''}`;
}
function Notice() {
  const s = useSports();
  return <p role={s.error ? 'alert' : 'status'}>{s.message}</p>;
}
function SportsStatus() {
  const s = useSports();
  return s.error && s.data ? <p role="status">{s.message}</p> : null;
}
export function Upcoming({ node }: { node: Element }) {
  const s = useSports();
  const m =
    s.matches.find((m) => m.status === 'scheduled') ??
    s.matches.find((m) => m.status !== 'finished');
  return (
    <span {...props(node)}>
      {m ? (
        <a href={matchLink(m)}>
          {m.venue || m.field || 'Venue to be confirmed'}
          <span className="bigslam-sep">/</span>
          {date(m)} · {date(m, 'time')}
        </a>
      ) : s.data && s.competitions.length ? (
        'No upcoming matches.'
      ) : (
        s.message
      )}
    </span>
  );
}
function MatchHeading({ node, index }: { node: Element; index: number }) {
  const s = useSports();
  let m = query().has('id') ? s.selected : s.matches[index];
  if (query().has('id') && index > 0) return null;
  return (
    <h3 {...props(node)}>
      {m ? (
        <a href={matchLink(m)}>
          {m.home} vs {m.away}
        </a>
      ) : (
        s.message
      )}
      <span className="gdlr-core-title-item-title-divider gdlr-core-skin-divider" />
    </h3>
  );
}
function SelectedPlayerHeading({
  node,
  index,
}: {
  node: Element;
  index: number;
}) {
  const s = useSports();
  const p = query().has('player')
    ? s.players.filter((p) => p.id === query().get('player'))[index]
    : s.players[index];
  return (
    <h3 {...props(node)}>
      {p?.name ?? s.message}
      <span className="gdlr-core-title-item-title-divider gdlr-core-skin-divider" />
    </h3>
  );
}
function Caption({
  node,
  index,
  page,
}: {
  node: Element;
  index: number;
  page: string;
}) {
  const s = useSports();
  const m = query().has('id')
    ? s.selected
    : s.matches[page === '/games-boxScores.php' ? 0 : index];
  const original = text(node).trim();
  let value: ReactNode = original;
  if (page === '/player-list.php') value = s.competitions[index]?.name ?? '—';
  else if (page === '/player-statics.php') value = s.data?.season?.name ?? '—';
  else if (/^Team \d+$/.test(original))
    value = m ? (index % 2 === 0 ? m.home : m.away) : '—';
  else if (
    (page === '/games-results.php' || page === '/games-details.php') &&
    m
  )
    value = `${original} · ${m.confirmed ? 'Confirmed' : m.status.replace('_', ' ')}`;
  if (
    page === '/player-list.php' &&
    index > 0 &&
    index >= s.competitions.length
  )
    return null;
  if (
    query().has('id') &&
    index > 0 &&
    (page === '/games-details.php' || page === '/games-results.php')
  )
    return null;
  return <h4 {...props(node)}>{value}</h4>;
}

function PlayerDetails({ node, index }: { node: Element; index: number }) {
  const s = useSports();
  const p = query().has('player')
    ? s.players.filter((p) => p.id === query().get('player'))[index]
    : s.players[index];
  return (
    <dl {...props(node)}>
      <dt>Nationality</dt>
      <dd>—</dd>
      <dt>Position</dt>
      <dd>—</dd>
      <dt>Current Team</dt>
      <dd>{p?.team ?? '—'}</dd>
    </dl>
  );
}
function TeamWidget({ node }: { node: Element }) {
  const s = useSports();
  return (
    <div {...props(node)}>
      <SportsStatus />
      <div className="gdlr-core-sp-player-item-holder clearfix">
        {s.competitions
          .filter((c) => c.standings.length > 0)
          .slice(0, 1)
          .flatMap((c) =>
            c.standings
              .filter(
                (r) => r.group === (query().get('group') || c.groups[0]?.name),
              )
              .slice(0, 4)
              .map((r) => (
                <div
                  key={r.id}
                  className="gdlr-core-item-list gdlr-core-item-pdlr gdlr-core-column-60 gdlr-core-column-first"
                >
                  <div
                    className="gdlr-core-sp-player-widget clearfix"
                    style={{ borderColor: '#5b5b5b' }}
                  >
                    <div className="gdlr-core-sp-player-thumbnail gdlr-core-media-image gdlr-core-zoom-on-hover">
                      <a
                        href={`/leaguetable.php?competition=${c.id}&group=${r.group ?? ''}`}
                      >
                        <img
                          src="/upload/logo.png"
                          width="150"
                          height="150"
                          alt=""
                        />
                      </a>
                    </div>
                    <div className="gdlr-core-sp-player-widget-content">
                      <h3
                        className="gdlr-core-sp-player-title gdlr-core-skin-title"
                        style={{ fontSize: 20 }}
                      >
                        <a
                          href={`/leaguetable.php?competition=${c.id}&group=${r.group ?? ''}`}
                        >
                          {r.name}
                        </a>
                      </h3>
                      <div className="gdlr-core-sp-player-widget-infos">
                        <div className="gdlr-core-sp-player-widget-info">
                          <span className="gdlr-core-head">{r.gf}</span>
                          <span className="gdlr-core-tail">
                            Goals · {c.name} {r.group}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )),
          )}
        {!s.competitions.some((c) => c.standings.length > 0) && <Notice />}
      </div>
    </div>
  );
}
function Featured({ node }: { node: Element }) {
  const s = useSports();
  if (!s.ready)
    return (
      <div {...props(node)}>
        <Notice />
      </div>
    );
  return (
    <div {...props(node)}>
      <SportsStatus />
      {s.matches.map((m, i) => (
        <div
          key={m.id}
          className={
            i === 0
              ? 'bigslam-sp-event-featured-top bigslam-status-vs'
              : 'bigslam-sp-event-featured-list clearfix'
          }
        >
          <div className="bigslam-sp-event-featured-title bigslam-title-font clearfix">
            {i === 0 ? (
              <>
                <div className="bigslam-sp-event-featured-title-left">
                  <span className="bigslam-sp-team-logo">
                    <img
                      src="/upload/logo.png"
                      width="120"
                      height="146"
                      alt=""
                    />
                  </span>
                  <span className="bigslam-sp-team-name">{m.home}</span>
                </div>
                <span className="bigslam-sp-event-result">
                  <a href={matchLink(m)}>
                    {m.status === 'scheduled'
                      ? 'VS'
                      : `${m.home_score} – ${m.away_score}`}
                  </a>
                </span>
                <div className="bigslam-sp-event-featured-title-right">
                  <span className="bigslam-sp-team-logo">
                    <img
                      src="/upload/logo.png"
                      width="110"
                      height="119"
                      alt=""
                    />
                  </span>
                  <span className="bigslam-sp-team-name">{m.away}</span>
                </div>
              </>
            ) : (
              <>
                <span className="bigslam-sp-team-logo">
                  <img src="/upload/logo.png" width="123" height="141" alt="" />
                </span>
                <span className="bigslam-sp-team-name">{m.home}</span>
                <span className="bigslam-sp-event-result">
                  <a href={matchLink(m)}>
                    {m.status === 'scheduled'
                      ? 'VS'
                      : `${m.home_score} – ${m.away_score}`}
                  </a>
                </span>
                <span className="bigslam-sp-team-name">{m.away}</span>
                <span className="bigslam-sp-team-logo">
                  <img src="/upload/logo.png" width="110" height="119" alt="" />
                </span>
              </>
            )}
          </div>
          <div className="bigslam-sp-event-featured-info">
            <span className="bigslam-sp-event-date">
              {date(m)} · {date(m, 'time')}
            </span>
            <span className="bigslam-sp-event-venue">
              {label(m)} · {m.venue || m.field || 'Venue to be confirmed'} ·{' '}
              {m.confirmed ? 'Confirmed' : m.status.replace('_', ' ')}
              {m.homePenalties !== null
                ? ` · Penalties ${m.homePenalties}–${m.awayPenalties}`
                : ''}
            </span>
          </div>
          {i > 0 && (
            <a
              className="bigslam-sp-event-link"
              href={matchLink(m)}
              aria-label={`Details ${m.home} vs ${m.away}`}
            />
          )}
        </div>
      ))}
      {!s.matches.length && <Notice />}
    </div>
  );
}
const headers = (n: Element) =>
  n.children.find((c) => c instanceof Element && c.name === 'thead') as
    Element | undefined;
function BoundTable({
  node,
  index,
  page,
}: {
  node: Element;
  index: number;
  page: string;
}) {
  const s = useSports();
  if (!s.ready)
    return (
      <div>
        <Notice />
      </div>
    );
  if (has(node, 'sp-calendar')) return <Calendar node={node} />;
  if (has(node, 'sp-league-table')) return <LeagueTables node={node} />;
  if (
    query().has('id') &&
    index > 0 &&
    (has(node, 'sp-event-details') || has(node, 'sp-event-results'))
  )
    return null;
  let rows: { id: string; values: Record<string, ReactNode> }[] = [];
  const matches = query().has('id')
    ? s.selected
      ? [s.selected]
      : []
    : s.matches;
  const playerId = query().get('player');
  const players = s.players.filter((p) => !playerId || p.id === playerId);
  if (has(node, 'schedule-table')) {
    const cut = Math.ceil(s.matches.length / 2);
    rows = s.matches
      .slice(index === 0 ? 0 : cut, index === 0 ? cut : undefined)
      .map((m, i) => ({
        id: m.id,
        values: {
          date: <span>{date(m)}</span>,
          match: (
            <a href={matchLink(m)}>
              {m.home} vs {m.away}
              <small style={{ display: 'block' }}>{label(m)}</small>
            </a>
          ),
          time: m.status === 'scheduled' ? date(m, 'time') : score(m),
        },
      }));
  } else if (has(node, 'sp-event-list'))
    rows = matches.map((m) => ({
      id: m.id,
      values: {
        date: date(m),
        event: (
          <a href={matchLink(m)}>
            {m.home} vs {m.away}
          </a>
        ),
        time: m.status === 'scheduled' ? date(m, 'time') : score(m),
        league: label(m),
        season: m.season,
        venue: m.venue || m.field || '—',
        article: <a href={matchLink(m)}>Details</a>,
      },
    }));
  else if (has(node, 'sp-event-blocks'))
    rows = matches.map((m) => ({
      id: m.id,
      values: {
        '': (
          <>
            <time className="sp-event-date">{date(m)}</time>
            <h5 className="sp-event-results">
              <a href={matchLink(m)}>{score(m)}</a>
            </h5>
            <h4 className="sp-event-title">
              <a href={matchLink(m)}>
                {m.home} vs {m.away}
              </a>
            </h4>
            <p>
              {label(m)} · {m.field || m.venue || '—'}
            </p>
          </>
        ),
      },
    }));
  else if (has(node, 'sp-event-details')) {
    const m = matches[index];
    rows = m
      ? [
          {
            id: m.id,
            values: {
              date: date(m),
              time: date(m, 'time'),
              league: label(m),
              season: m.season,
            },
          },
        ]
      : [];
  } else if (has(node, 'sp-event-results')) {
    const m = matches[index];
    rows = m
      ? [
          { id: m.id + 'h', values: { name: m.home, goals: m.home_score } },
          { id: m.id + 'a', values: { name: m.away, goals: m.away_score } },
        ]
      : [];
  } else if (has(node, 'sp-player-list')) {
    if (index > 0 && index >= s.competitions.length) return null;
    rows = players
      .filter((p) => p.competitionId === s.competitions[index]?.id)
      .map((p) => ({
        id: p.rosterId,
        values: {
          number: p.number,
          name: (
            <a href={playerLink(p)}>
              {p.name} · {p.team} · {p.category} {p.group_name}
            </a>
          ),
        },
      }));
  } else if (has(node, 'sp-player-statistics'))
    rows = players.map((p) => ({
      id: p.rosterId,
      values: {
        name: s.data?.season?.name,
        team: (
          <a href={playerLink(p)}>
            {p.team} · {p.name}
          </a>
        ),
        goals: p.goals,
        owngoals: p.ownGoals,
      },
    }));
  if (has(node, 'sp-event-performance'))
    return <BoxScore node={node} side={index % 2} match={matches[0]} />;
  return (
    <>
      <SportsStatus />
      <DataTable node={node} rows={rows} />
    </>
  );
}
type TableRow = { id: string; values: Record<string, ReactNode> };
function content(value: ReactNode): string {
  return isValidElement<{ children?: ReactNode }>(value)
    ? content(value.props.children)
    : Array.isArray(value)
      ? value.map(content).join(' ')
      : String(value ?? '');
}
function DataTable({
  node,
  rows,
  caption,
}: {
  node: Element;
  rows: TableRow[];
  caption?: string;
}) {
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(
      null,
    ),
    [page, setPage] = useState(0);
  const header = headers(node),
    columns = header
      ? header.children
          .filter((n) => n instanceof Element)
          .flatMap(
            (n) =>
              (n as Element).children.filter(
                (c) => c instanceof Element && c.name === 'th',
              ) as Element[],
          )
      : [];
  const keys = columns.map(
    (c) =>
      c.attribs.class?.replace('data-', '').split(' ')[0] ??
      text(c).toLowerCase(),
  );
  const sortable = has(node, 'sp-sortable-table'),
    size = Number(node.attribs['data-sp-rows'] || 10),
    paginate = has(node, 'sp-paginated-table') && rows.length > size;
  const sorted = sort
    ? [...rows].sort(
        (a, b) =>
          content(a.values[sort.key]).localeCompare(
            content(b.values[sort.key]),
            'en',
            { numeric: true },
          ) * (sort.descending ? -1 : 1),
      )
    : rows;
  const pages = paginate ? Math.ceil(rows.length / size) : 1,
    current = Math.min(page, pages - 1),
    visible = paginate
      ? sorted.slice(current * size, (current + 1) * size)
      : sorted;
  const table = (
    <table
      {...props(node)}
      className={
        (node.attribs.class ?? '') +
        (sortable || paginate ? ' dataTable no-footer' : '')
      }
    >
      {caption && <caption className="sp-table-caption">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((column, j) => (
            <th
              {...props(column)}
              key={j}
              className={
                (column.attribs.class ?? '') +
                (sortable
                  ? ' ' +
                    (sort?.key === keys[j]
                      ? sort.descending
                        ? 'sorting_desc'
                        : 'sorting_asc'
                      : 'sorting')
                  : '')
              }
              {...(sortable
                ? {
                    tabIndex: 0,
                    role: 'columnheader',
                    'aria-label': text(column).trim(),
                    'aria-sort':
                      sort?.key === keys[j]
                        ? sort.descending
                          ? ('descending' as const)
                          : ('ascending' as const)
                        : ('none' as const),
                    onClick: () => {
                      setSort({
                        key: keys[j],
                        descending:
                          sort?.key === keys[j] ? !sort.descending : false,
                      });
                      setPage(0);
                    },
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSort({
                          key: keys[j],
                          descending:
                            sort?.key === keys[j] ? !sort.descending : false,
                        });
                        setPage(0);
                      }
                    },
                  }
                : {})}
            >
              {domToReact(column.children as DOMNode[])}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visible.map((r, i) => (
          <tr key={r.id} className={i % 2 ? 'even' : 'odd'}>
            {keys.map((k, j) => (
              <td
                key={j}
                className={
                  has(node, 'schedule-table')
                    ? [
                        'date-col',
                        `match-col${i % 2 ? ' highlight' : ''}`,
                        'time-col',
                      ][j]
                    : columns[j].attribs.class
                }
                data-label={text(columns[j])}
              >
                {r.values[k] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
        {!visible.length && (
          <tr>
            <td colSpan={Math.max(keys.length, 1)}>
              <Notice />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
  let result: ReactNode = table;
  if (sortable || paginate)
    result = (
      <div className="dataTables_wrapper no-footer">
        {table}
        {paginate && (
          <div className="dataTables_paginate paging_simple_numbers">
            <a
              href="#"
              className={
                'paginate_button previous' + (current === 0 ? ' disabled' : '')
              }
              aria-disabled={current === 0}
              onClick={(e) => {
                e.preventDefault();
                setPage(Math.max(0, current - 1));
              }}
            >
              Previous
            </a>
            <span>
              {Array.from({ length: pages }, (_, i) => (
                <a
                  href="#"
                  key={i}
                  className={
                    'paginate_button' + (current === i ? ' current' : '')
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(i);
                  }}
                >
                  {i + 1}
                </a>
              ))}
            </span>
            <a
              href="#"
              className={
                'paginate_button next' +
                (current === pages - 1 ? ' disabled' : '')
              }
              aria-disabled={current === pages - 1}
              onClick={(e) => {
                e.preventDefault();
                setPage(Math.min(pages - 1, current + 1));
              }}
            >
              Next
            </a>
          </div>
        )}
      </div>
    );
  return has(node, 'sp-scrollable-table') ? (
    <div className="sp-scrollable-table-wrapper">{result}</div>
  ) : (
    result
  );
}

function LeagueTables({ node }: { node: Element }) {
  const s = useSports(),
    group = query().get('group');
  return (
    <>
      {s.competitions.flatMap((c) =>
        c.groups
          .filter((g) => !group || g.name === group)
          .map((g) => (
            <DataTable
              node={node}
              key={g.id}
              caption={`${c.name} · ${g.name}`}
              rows={c.standings
                .filter((r) => r.groupId === g.id)
                .map((r, i) => ({
                  id: r.id,
                  values: { rank: i + 1, name: r.name, w: r.wins, l: r.losses },
                }))}
            />
          )),
      )}
      {!s.competitions.length && <Notice />}
      <SportsStatus />
    </>
  );
}

function BoxScore({
  node,
  side,
  match,
}: {
  node: Element;
  side: number;
  match?: SiteMatch;
}) {
  const s = useSports();
  const detail = usePublic<{
    events: {
      entryId: string;
      player: string | null;
      number: number | null;
      kind: string;
      id: string;
    }[];
  }>(match ? `matches/${match.id}` : null, true);
  const entry = side === 0 ? match?.homeEntryId : match?.awayEntryId;
  const players = s.players.filter((p) => p.entryId === entry);
  return (
    <table {...props(node)}>
      <tbody>
        {players.map((p, i) => (
          <tr className={`lineup ${i % 2 ? 'even' : 'odd'}`} key={p.rosterId}>
            <td className="data-number">{p.number}</td>
            <td className="data-name">
              <a href={playerLink(p)}>{p.name}</a>
            </td>
            <td className="sp-performance-icons">
              {detail.data?.events
                .filter(
                  (e) =>
                    e.entryId === entry &&
                    e.player === p.name &&
                    e.number === p.number,
                )
                .map((e) => (
                  <i
                    key={e.id}
                    className="sp-icon-soccerball"
                    title={e.kind === 'own_goal' ? 'Own goal' : 'Goal'}
                    style={{ color: '#222222' }}
                  />
                ))}
            </td>
          </tr>
        ))}
        {!players.length && (
          <tr>
            <td colSpan={3}>
              <Notice />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
function Calendar({ node }: { node: Element }) {
  const s = useSports();
  const [offset, setOffset] = useState(0);
  const first = s.matches.find((m) => m.scheduled_iso);
  const zone = s.data?.season?.timezone ?? 'UTC';
  const day = first?.scheduled_iso
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(first.scheduled_iso))
    : new Date().toISOString().slice(0, 10);
  const year = Number(day.slice(0, 4)),
    month = Number(day.slice(5, 7)) - 1;
  const start = new Date(Date.UTC(year, month + offset, 1)),
    y = start.getUTCFullYear(),
    mo = start.getUTCMonth(),
    lead = (start.getUTCDay() + 6) % 7,
    total = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((lead + total) / 7) * 7 },
    (_, i) => i - lead + 1,
  );
  return (
    <table {...props(node)}>
      <caption className="sp-table-caption">
        {new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          month: 'long',
          year: 'numeric',
        }).format(start)}
      </caption>
      <thead>
        <tr>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <th key={i}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <tr key={week}>
            {cells.slice(week * 7, week * 7 + 7).map((n, i) => {
              const key = `${y}-${String(mo + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
              const matches = s.matches.filter(
                (m) =>
                  m.scheduled_iso &&
                  new Intl.DateTimeFormat('en-CA', {
                    timeZone: zone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  }).format(new Date(m.scheduled_iso)) === key,
              );
              return (
                <td key={i}>
                  {n > 0 && n <= total ? (
                    <>
                      {matches.length ? (
                        <a
                          href={
                            '/games-list.php?' +
                            new URLSearchParams({
                              date: key,
                              ...(query().get('competition')
                                ? { competition: query().get('competition')! }
                                : {}),
                              ...(query().get('group')
                                ? { group: query().get('group')! }
                                : {}),
                            }).toString()
                          }
                          title={matches
                            .map((m) => `${m.home} vs ${m.away}`)
                            .join(', ')}
                        >
                          {n}
                        </a>
                      ) : (
                        n
                      )}
                    </>
                  ) : null}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3}>
            <button
              onClick={() => setOffset((v) => v - 1)}
              aria-label="Previous month"
            >
              «
            </button>
          </td>
          <td />
          <td colSpan={3}>
            <button
              onClick={() => setOffset((v) => v + 1)}
              aria-label="Next month"
            >
              »
            </button>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
function PlayerGallery({ node, index }: { node: Element; index: number }) {
  const s = useSports();
  if (index > 0) return null;
  return (
    <div {...props(node)}>
      <div className="sp-player-gallery-wrapper sp-gallery-wrapper">
        <h4 className="sp-gallery-group-name player-group-name player-gallery-group-name">
          Players
        </h4>
        {s.players.map((p) => (
          <dl className="gallery-item" key={p.rosterId}>
            <dt className="gallery-icon portrait">
              <a href={playerLink(p)}>
                <img
                  src="/images/player-placeholder.png"
                  width="300"
                  height="300"
                  alt=""
                />
              </a>
            </dt>
            <dd className="wp-caption-text gallery-caption small-3 columns has-number">
              <a href={playerLink(p)}>
                <strong>{p.number}</strong> {p.name} · {p.team}
              </a>
            </dd>
          </dl>
        ))}
        {!s.players.length && <Notice />}
      </div>
    </div>
  );
}
export function sportsReplacement(
  node: Element,
  page: string,
  count: Record<string, number>,
): ReactNode | undefined {
  const next = (key: string) => {
    const i = count[key] ?? 0;
    count[key] = i + 1;
    return i;
  };
  if (has(node, 'bigslam-upcoming-match-link')) return <Upcoming node={node} />;
  if (has(node, 'gdlr-core-sp-player-item')) return <TeamWidget node={node} />;
  if (has(node, 'bigslam-sp-event-featured-holder'))
    return <Featured node={node} />;
  if (
    node.name === 'table' &&
    (has(node, 'schedule-table') ||
      classes(node).some((c) => c.startsWith('sp-')))
  )
    return <BoundTable node={node} index={next('table')} page={page} />;
  if (node.name === 'h3' && /^Team \d+ vs Team \d+/.test(text(node).trim()))
    return <MatchHeading node={node} index={next('matchHeading')} />;
  if (node.name === 'h4' && has(node, 'sp-table-caption'))
    return <Caption node={node} index={next('caption')} page={page} />;
  if (page === '/player-details.php') {
    if (node.name === 'h3' && has(node, 'gdlr-core-title-item-title'))
      return (
        <SelectedPlayerHeading node={node} index={next('playerHeading')} />
      );
    if (has(node, 'sp-player-details'))
      return <PlayerDetails node={node} index={next('playerDetail')} />;
    if (has(node, 'sp-player-photo'))
      return (
        <div {...props(node)}>
          <img
            src="/images/player-placeholder.png"
            width="300"
            height="197"
            style={{ height: 197, objectFit: 'contain' }}
            alt=""
          />
        </div>
      );
  }
  if (has(node, 'sp-template-player-gallery'))
    return <PlayerGallery node={node} index={next('gallery')} />;
  return undefined;
}
