import { useEffect, useRef, useState } from 'react';
export interface Match {
  id: number | string;
  category_id: number | string;
  competitionId?: string;
  category: string;
  group_name: string | null;
  status: string;
  elapsed: number;
  home: string;
  away: string;
  home_score: number;
  away_score: number;
  home_crest?: string | null;
  away_crest?: string | null;
  field: string | null;
  scheduled_iso: string | null;
  updated_at: string;
  timezone: string;
}
export interface Poster {
  id: number;
  image: string;
  alt: string;
  title: string;
  link: string | null;
}
export interface Feed {
  server_time: string;
  season: unknown;
  matches: Match[];
  posters: Poster[];
  data_origin?: string;
}
export interface FeedState {
  data: Feed | null;
  stale: boolean;
}
const activeStates = ['live', 'half_time', 'paused'];
export function useFeed(): FeedState {
  const [state, setState] = useState<FeedState>({ data: null, stale: false });
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      inFlight = false;
    const controller = new AbortController();
    const poll = async () => {
      if (disposed || document.hidden || inFlight) return;
      inFlight = true;
      try {
        const r = await fetch('/api/v1/public/live', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!r.ok) throw Error();
        const d = await r.json();
        if (!disposed) setState({ data: d, stale: false });
      } catch {
        if (!disposed) setState((s) => ({ ...s, stale: true }));
      } finally {
        inFlight = false;
        if (!disposed) timer = setTimeout(poll, 5000);
      }
    };
    const visible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener('visibilitychange', visible);
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return state;
}
export const status = (m: Match) =>
  m.away === 'BYE'
    ? 'Bye · advances'
    : ({
        scheduled: 'Scheduled',
        live: 'LIVE',
        half_time: 'Half-time',
        paused: 'Paused',
        finished: 'Final',
        suspended: 'Suspended',
      }[m.status] || m.status) +
      (activeStates.includes(m.status)
        ? ` · ${Math.floor(m.elapsed / 60)}′`
        : '');
export const time = (m: Match) =>
  m.scheduled_iso
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: m.timezone,
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(m.scheduled_iso))
    : 'Time TBA';
function today(m: Match) {
  const date =
    m.scheduled_iso ||
    (m.status === 'finished' ? m.updated_at.replace(' ', 'T') + 'Z' : null);
  return (
    date &&
    new Intl.DateTimeFormat('en-CA', { timeZone: m.timezone }).format(
      new Date(date),
    ) ===
      new Intl.DateTimeFormat('en-CA', { timeZone: m.timezone }).format(
        new Date(),
      )
  );
}
export function priority(matches: Match[]) {
  const rank = (m: Match) =>
    activeStates.includes(m.status)
      ? 0
      : today(m) && m.status === 'finished'
        ? 1
        : m.status === 'scheduled'
          ? 2
          : m.status === 'finished'
            ? 3
            : 4;
  return [...matches].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.status === 'finished' && b.status === 'finished'
        ? b.updated_at.localeCompare(a.updated_at)
        : String(a.scheduled_iso || '9999').localeCompare(
            String(b.scheduled_iso || '9999'),
          )) ||
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
  );
}
export function MatchCard({ match: m }: { match: Match }) {
  return (
    <article className="cup-match-card" data-game-id={m.id}>
      <a href={`match.php?id=${m.id}`}>
        <small>
          {m.category}
          {m.group_name ? ' · ' + m.group_name : ''}
        </small>
        <p
          className={'cup-badge ' + (m.status === 'live' ? 'is-live' : '')}
          data-game-status
        >
          {status(m)}
        </p>
        <div className="cup-team-row">
          {m.home_crest && (
            <img src={m.home_crest} alt="" loading="lazy" decoding="async" />
          )}
          {m.home}
          <b data-home-score>{m.home_score}</b>
        </div>
        <div className="cup-team-row">
          {m.away_crest && (
            <img src={m.away_crest} alt="" loading="lazy" decoding="async" />
          )}
          {m.away}
          <b data-away-score>{m.away_score}</b>
        </div>
        <div className="cup-card-footer">
          <span>{m.field || 'Field TBA'}</span>
          <span>{time(m)}</span>
        </div>
      </a>
    </article>
  );
}
export function Ticker({ feed }: { feed: FeedState }) {
  const [paused, setPaused] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const hover = useRef(false);
  const pause = useRef(false);
  pause.current = paused;
  useEffect(() => {
    let frame = 0,
      last = 0,
      position = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const animate = (t: number) => {
      const el = track.current;
      if (el) {
        if (
          !document.hidden &&
          !pause.current &&
          !hover.current &&
          !reduced.matches &&
          last &&
          el.scrollWidth > el.clientWidth
        ) {
          position += Math.min(t - last, 50) * 0.025;
          if (position >= el.scrollWidth - el.clientWidth) position = 0;
          el.scrollLeft = position;
        } else position = el.scrollLeft;
      }
      last = t;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <>
      <section
        id="cup-ticker"
        className="cup-ticker"
        aria-label="Tournament scores"
        hidden={!feed.data?.matches.length}
      >
        <div className="cup-ticker-label">
          <span>MATCH CENTER</span>
          <button
            id="cup-ticker-pause"
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? 'Play' : 'Pause'}
          </button>
        </div>
        <div
          id="cup-ticker-track"
          className="cup-ticker-track"
          tabIndex={0}
          aria-label="Scroll through results"
          ref={track}
          onPointerEnter={() => (hover.current = true)}
          onPointerLeave={() => (hover.current = false)}
          onFocus={() => (hover.current = true)}
          onBlur={() => (hover.current = false)}
          onPointerDown={() => setPaused(true)}
          onWheel={() => setPaused(true)}
          onKeyDown={() => setPaused(true)}
        >
          {priority(feed.data?.matches ?? []).map((m) => (
            <a
              className="cup-ticker-game"
              data-ticker-id={m.id}
              key={m.id}
              href={`match.php?id=${m.id}`}
            >
              <small>
                <span>{m.category}</span>
                <span
                  data-ticker-status
                  className={m.status === 'live' ? 'cup-live-dot' : ''}
                >
                  {m.status === 'scheduled' ? time(m) : status(m)}
                </span>
              </small>
              <strong>
                <span>{m.home}</span>
                <span data-home-score>
                  {m.status === 'scheduled' ? '–' : m.home_score}
                </span>
              </strong>
              <strong>
                <span>{m.away}</span>
                <span data-away-score>
                  {m.status === 'scheduled' ? '–' : m.away_score}
                </span>
              </strong>
            </a>
          ))}
        </div>
      </section>
      <div id="cup-stale" className="cup-stale" hidden={!feed.stale}>
        Live connection unavailable. Showing the last available results;
        retrying automatically.
      </div>
    </>
  );
}
export function LiveSection({ feed }: { feed: FeedState }) {
  const [selected, setSelected] = useState('');
  const matches = (feed.data?.matches ?? []).filter(
    (m) => !selected || String(m.category_id) === selected,
  );
  const active = priority(
    matches.filter((m) => activeStates.includes(m.status)),
  );
  const suspended = matches.filter((m) => m.status === 'suspended');
  const shown = active.length
    ? active
    : priority(
        matches.filter(
          (m) =>
            m.status === 'scheduled' || (m.status === 'finished' && today(m)),
        ),
      ).slice(0, 12);
  const categories = [
    ...new Map(
      (feed.data?.matches ?? []).map((m) => [
        String(m.category_id),
        m.category,
      ]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <section className="cup-live-section">
      <div className="cup-section">
        <div className="cup-section-heading">
          <div>
            <p className="cup-eyebrow">MATCH CENTER</p>
            <h2 id="cup-live-title">
              {!feed.data || active.length
                ? 'Live now'
                : 'Around the tournament'}
            </h2>
            <p className="cup-muted">
              Every category. Every field. Scores refresh automatically.
            </p>
          </div>
          <label>
            Category
            <select
              id="cup-category-filter"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div id="cup-live-cards" className="cup-match-grid">
          {!feed.data ? (
            <p className="cup-empty">Loading matchday…</p>
          ) : shown.length ? (
            shown.map((m) => <MatchCard key={m.id} match={m} />)
          ) : (
            <p className="cup-empty">
              No games are scheduled yet. Check back for the next matchday.
            </p>
          )}
        </div>
        <div id="cup-suspended" hidden={!suspended.length}>
          {!!suspended.length && (
            <>
              <h3>Suspended games</h3>
              <div className="cup-match-grid">
                {suspended.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
export function Posters({ posters }: { posters: Poster[] }) {
  const root = useRef<HTMLDivElement>(null);
  return (
    <section
      id="cup-poster-area"
      className="cup-poster-area"
      hidden={!posters.length}
    >
      <div className="cup-section">
        <div className="cup-section-heading">
          <div>
            <p className="cup-eyebrow">ON THE CALENDAR</p>
            <h2>Coming up at the Cup</h2>
          </div>
          <div className="cup-poster-controls">
            {[-1, 1].map((n) => (
              <button
                key={n}
                data-poster-scroll={n}
                aria-label={n < 0 ? 'Previous posters' : 'Next posters'}
                onClick={() =>
                  root.current?.scrollBy({
                    left: n * 360,
                    behavior: matchMedia('(prefers-reduced-motion: reduce)')
                      .matches
                      ? 'instant'
                      : 'smooth',
                  })
                }
              >
                {n < 0 ? '←' : '→'}
              </button>
            ))}
          </div>
        </div>
        <div
          id="cup-posters"
          className="cup-posters"
          aria-label="Tournament posters"
          ref={root}
        >
          {posters.map((p) => (
            <article key={p.id} className="cup-poster">
              {p.link ? (
                <a href={p.link} rel="noopener noreferrer">
                  <img
                    src={p.image}
                    alt={p.alt}
                    loading="lazy"
                    decoding="async"
                  />
                </a>
              ) : (
                <img
                  src={p.image}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <h3>{p.title}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
