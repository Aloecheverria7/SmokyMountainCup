import { MatchCard, type Match, type FeedState } from './live';
import { usePublic } from './public-api';
export function PublicMatch({ feed }: { feed: FeedState }) {
  const id = new URLSearchParams(location.search).get('id') ?? '';
  return feed.data?.data_origin === 'native' ? (
    <NativeMatch id={id} />
  ) : (
    <main id="main-content" className="cup-section">
      {(() => {
        const m = feed.data?.matches.find((m) => String(m.id) === id);
        return (
          <>
            <h1>{m ? `${m.home} vs ${m.away}` : 'Match not found'}</h1>
            {m && <MatchCard match={m} />}
            <a href="tournament.php">Return to tournament</a>
          </>
        );
      })()}
    </main>
  );
}
function NativeMatch({ id }: { id: string }) {
  const resource = usePublic<{
    data: Match & {
      season: string;
      competitionId: string;
      seasonId: string;
      venue: string | null;
      confirmed: boolean;
      homePenalties: number | null;
      awayPenalties: number | null;
    };
    events: {
      id: string;
      minute: number;
      team: string;
      player: string | null;
      kind: string;
      number: number | null;
    }[];
  }>(id ? `matches/${id}` : null, true);
  const m = resource.data?.data;
  return (
    <main id="main-content" className="cup-section">
      {resource.error && (
        <p role="alert" className="cup-stale">
          {resource.error}
        </p>
      )}
      {m ? (
        <>
          <p className="cup-eyebrow">
            {m.season} · {m.category}
          </p>
          <h1>
            {m.home} vs {m.away}
          </h1>
          <MatchCard match={m} />
          {m.homePenalties !== null && (
            <p>
              Penalties: {m.homePenalties} – {m.awayPenalties}
            </p>
          )}
          <p className="cup-muted">
            {m.venue ?? 'Venue TBA'} · Times shown in {m.timezone}.{' '}
            {m.confirmed
              ? 'Official result.'
              : 'Result subject to confirmation.'}
          </p>
          <h2>Match events</h2>
          <ol>
            {resource.data!.events.map((e) => (
              <li key={e.id}>
                {e.minute}′ · {e.team} · {e.player ?? 'Scorer not recorded'}
                {e.number !== null ? ' #' + e.number : ''}
                {e.kind === 'own_goal' ? ' (own goal)' : ''}
              </li>
            ))}
          </ol>
          <a
            href={`tournament.php?season=${m.seasonId}&category=${m.competitionId}`}
          >
            Competition standings ↗
          </a>
        </>
      ) : (
        <>
          <h1>{resource.loading ? 'Loading match…' : 'Match not found'}</h1>
          <a href="tournament.php">Return to tournament</a>
        </>
      )}
    </main>
  );
}
