import { useState } from 'react';
import { DateTime } from 'luxon';
import { MatchCard, type Match } from '../live';
import {
  ActionForm,
  CollectionFooter,
  text,
  useCollection,
} from './components';
import {
  PendingNotice,
  useCompetition,
  useOperation,
  useResource,
} from './sports';
import type { StaffUser } from './types';
import type { Field } from './Venues';
import { scheduleOptions } from './time';
interface StaffMatch extends Match {
  id: string;
  competitionId: string;
  homeEntryId: string | null;
  awayEntryId: string | null;
  fieldId: string | null;
  scorerId: string | null;
  confirmed: boolean;
  archived: boolean;
  stage: string;
  roundNo: number;
  homePenalties: number | null;
  awayPenalties: number | null;
  version: number;
}
interface Detail {
  data: StaffMatch;
  events: {
    id: string;
    entryId: string;
    kind: string;
    minute: number;
    reason: string | null;
    voidedAt: string | null;
    player: string | null;
    number: number | null;
    team: string;
  }[];
  roster: { id: string; entryId: string; name: string; number: number }[];
}
const labels: Record<string, string> = {
  scheduled: 'Pendiente',
  live: 'En juego',
  half_time: 'Descanso',
  paused: 'Pausa',
  finished: 'Finalizado',
  suspended: 'Suspendido',
};
const transitions: Record<string, string[]> = {
  scheduled: ['live', 'suspended'],
  live: ['half_time', 'paused', 'finished', 'suspended'],
  half_time: ['live', 'finished', 'suspended'],
  paused: ['live', 'finished', 'suspended'],
  suspended: ['live', 'finished'],
  finished: [],
};
export function Matches({
  user,
  revision,
  refresh,
}: {
  user: StaffUser;
  revision: number;
  refresh: () => void;
}) {
  return user.role === 'admin' ? (
    <AdminMatches user={user} revision={revision} refresh={refresh} />
  ) : (
    <>
      <h1>Mis partidos</h1>
      <MatchList
        path="matches"
        user={user}
        revision={revision}
        refresh={refresh}
      />
    </>
  );
}
function AdminMatches({
  user,
  revision,
  refresh,
}: {
  user: StaffUser;
  revision: number;
  refresh: () => void;
}) {
  const { competition, selector } = useCompetition(revision);
  return (
    <>
      <h1>Partidos y calendario</h1>
      {selector}
      {competition && (
        <MatchList
          key={competition.id}
          path={`matches?competitionId=${competition.id}`}
          user={user}
          revision={revision}
          refresh={refresh}
        />
      )}
    </>
  );
}
function MatchList({
  path,
  user,
  revision,
  refresh,
}: {
  path: string;
  user: StaffUser;
  revision: number;
  refresh: () => void;
}) {
  const list = useCollection<StaffMatch>(path, revision, true);
  const [selected, setSelected] = useState('');
  return (
    <>
      <div className="cup-match-grid">
        {list.data.map((m) => (
          <section key={m.id} className="smc-match-pick">
            <MatchCard match={m} />
            <button className="cup-secondary" onClick={() => setSelected(m.id)}>
              Abrir {m.home} vs {m.away}
            </button>
          </section>
        ))}
      </div>
      {!list.loading && !list.data.length && (
        <p className="cup-empty">
          No hay partidos disponibles. El administrador debe publicar el sorteo
          y asignar los anotadores.
        </p>
      )}
      <CollectionFooter list={list} />
      {selected && (
        <MatchEditor
          key={selected}
          id={selected}
          user={user}
          revision={revision}
          refresh={refresh}
        />
      )}
    </>
  );
}
function MatchEditor({
  id,
  user,
  revision,
  refresh,
}: {
  id: string;
  user: StaffUser;
  revision: number;
  refresh: () => void;
}) {
  const resource = useResource<Detail>(`matches/${id}`, revision, true),
    op = useOperation(user.id + ':match:' + id);
  const execute = async (...args: Parameters<typeof op.execute>) => {
    const response = await op.execute(...args);
    resource.update(response);
    return response;
  };
  const snapshot = resource.data,
    m = snapshot?.data;
  return (
    <section className="cup-panel smc-match-editor">
      {resource.error && (
        <p role="alert" className="cup-message error">
          {resource.error}
        </p>
      )}
      {m && (
        <>
          <h2>
            {m.home} vs {m.away}
          </h2>
          <p>
            {m.category} ·{' '}
            {m.stage === 'group'
              ? 'Grupo ' + m.group_name
              : 'Ronda ' + m.roundNo}{' '}
            · {labels[m.status]}
            {m.confirmed ? ' · Resultado confirmado' : ''}
          </p>
          <p className="smc-score" aria-label="Marcador">
            {m.home_score} – {m.away_score}
          </p>
          <p>
            Reloj del servidor: {Math.floor(m.elapsed / 60)}:
            {String(m.elapsed % 60).padStart(2, '0')}
          </p>
          {m.homePenalties !== null && (
            <p>
              Penales: {m.homePenalties} – {m.awayPenalties}
            </p>
          )}
          <PendingNotice operation={op} refresh={refresh} />
          <fieldset disabled={op.sending || !!op.pending || resource.loading}>
            {m.archived ? (
              <p className="cup-stale">Temporada archivada: solo lectura.</p>
            ) : (
              <>
                {user.role === 'admin' && (
                  <Scheduling
                    match={m}
                    execute={execute}
                    refresh={refresh}
                    revision={revision}
                  />
                )}
                <div className="cup-split">
                  <section>
                    {!m.confirmed && !!transitions[m.status]?.length && (
                      <ActionForm
                        submit="Cambiar estado"
                        action={(d) =>
                          execute(`matches/${id}/status`, {
                            expectedVersion: m.version,
                            status: text(d, 'status'),
                          })
                        }
                        onSuccess={refresh}
                      >
                        <label>
                          Nuevo estado
                          <select
                            name="status"
                            required
                            defaultValue=""
                            key={m.status}
                          >
                            <option value="" disabled>
                              Selecciona el nuevo estado
                            </option>
                            {transitions[m.status].map((s) => (
                              <option value={s} key={s}>
                                {labels[s]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </ActionForm>
                    )}
                    {!m.confirmed &&
                      m.homeEntryId &&
                      m.awayEntryId &&
                      ['live', 'half_time', 'paused', 'finished'].includes(
                        m.status,
                      ) && (
                        <GoalForm
                          snapshot={snapshot!}
                          execute={execute}
                          refresh={refresh}
                        />
                      )}
                  </section>
                  <section>
                    {user.role === 'admin' &&
                      m.status === 'finished' &&
                      !m.confirmed && (
                        <ActionForm
                          submit="Confirmar resultado"
                          action={(d) =>
                            execute(`matches/${id}/confirm`, {
                              expectedVersion: m.version,
                              ...(m.stage === 'knockout' &&
                              m.home_score === m.away_score
                                ? {
                                    homePenalties: Number(
                                      d.get('homePenalties'),
                                    ),
                                    awayPenalties: Number(
                                      d.get('awayPenalties'),
                                    ),
                                  }
                                : {}),
                            })
                          }
                          onSuccess={refresh}
                        >
                          <h3>Confirmación oficial</h3>
                          {m.stage === 'knockout' &&
                            m.home_score === m.away_score && (
                              <>
                                <label>
                                  Penales de {m.home}
                                  <input
                                    name="homePenalties"
                                    type="number"
                                    min={0}
                                    max={100}
                                    required
                                  />
                                </label>
                                <label>
                                  Penales de {m.away}
                                  <input
                                    name="awayPenalties"
                                    type="number"
                                    min={0}
                                    max={100}
                                    required
                                  />
                                </label>
                              </>
                            )}
                        </ActionForm>
                      )}
                    {user.role === 'admin' &&
                      m.confirmed &&
                      m.homeEntryId &&
                      m.awayEntryId && (
                        <details>
                          <summary>Reabrir resultado</summary>
                          <ActionForm
                            submit="Reabrir resultado"
                            action={(d) =>
                              execute(`matches/${id}/reopen`, {
                                expectedVersion: m.version,
                                reason: text(d, 'reason'),
                              })
                            }
                            onSuccess={refresh}
                          >
                            <label>
                              Motivo
                              <input name="reason" maxLength={255} required />
                            </label>
                            <p className="cup-muted">
                              Las rondas dependientes no iniciadas deben
                              retirarse desde Organización antes de reabrir.
                            </p>
                          </ActionForm>
                        </details>
                      )}
                  </section>
                </div>
              </>
            )}
            <h3>Eventos del partido</h3>
            {!snapshot?.events.length && <p>No hay goles registrados.</p>}
            {snapshot?.events.map((e) => (
              <article
                key={e.id}
                className={'smc-record ' + (e.voidedAt ? 'cup-voided' : '')}
              >
                <p>
                  {e.minute}′ · {e.team} · {e.player ?? 'Autor sin identificar'}
                  {e.number !== null ? ' #' + e.number : ''}
                  {e.kind === 'own_goal' ? ' · Autogol' : ''}
                  {e.voidedAt ? ' · Anulado: ' + e.reason : ''}
                </p>
                {!e.voidedAt && !m.confirmed && !m.archived && (
                  <details>
                    <summary>Anular evento</summary>
                    <ActionForm
                      submit="Anular con motivo"
                      action={(d) =>
                        execute(`matches/${id}/events/${e.id}/void`, {
                          expectedVersion: m.version,
                          reason: text(d, 'reason'),
                        })
                      }
                      onSuccess={refresh}
                    >
                      <label>
                        Motivo
                        <input name="reason" maxLength={255} required />
                      </label>
                    </ActionForm>
                  </details>
                )}
              </article>
            ))}
          </fieldset>
        </>
      )}
    </section>
  );
}
function GoalForm({
  snapshot,
  execute,
  refresh,
}: {
  snapshot: Detail;
  execute: ReturnType<typeof useOperation>['execute'];
  refresh: () => void;
}) {
  const m = snapshot.data;
  const [entry, setEntry] = useState(m.homeEntryId!);
  return (
    <ActionForm
      reset
      submit="Registrar gol"
      action={(d) =>
        execute(`matches/${m.id}/events`, {
          expectedVersion: m.version,
          entryId: entry,
          rosterId: text(d, 'rosterId') || null,
          kind: text(d, 'kind'),
          minute: Number(d.get('minute')),
        })
      }
      onSuccess={refresh}
    >
      <h3>Registrar gol o autogol</h3>
      <label>
        Equipo del autor
        <select value={entry} onChange={(e) => setEntry(e.target.value)}>
          <option value={m.homeEntryId!}>{m.home}</option>
          <option value={m.awayEntryId!}>{m.away}</option>
        </select>
      </label>
      <label>
        Tipo
        <select name="kind">
          <option value="goal">Gol</option>
          <option value="own_goal">Autogol · suma al rival</option>
        </select>
      </label>
      <label>
        Autor (opcional)
        <select key={entry} name="rosterId" defaultValue="">
          <option value="">Autor sin identificar</option>
          {snapshot.roster
            .filter((r) => r.entryId === entry)
            .map((r) => (
              <option key={r.id} value={r.id}>
                #{r.number} {r.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Minuto
        <input
          name="minute"
          type="number"
          min={0}
          max={300}
          required
          defaultValue={Math.floor(m.elapsed / 60)}
        />
      </label>
    </ActionForm>
  );
}
function Scheduling({
  match: m,
  execute,
  refresh,
  revision,
}: {
  match: StaffMatch;
  execute: ReturnType<typeof useOperation>['execute'];
  refresh: () => void;
  revision: number;
}) {
  const fields = useCollection<Field>('fields', revision),
    users = useCollection<StaffUser>('users', revision);
  const [local, setLocal] = useState(
    m.scheduled_iso
      ? DateTime.fromISO(m.scheduled_iso)
          .setZone(m.timezone)
          .toFormat("yyyy-MM-dd'T'HH:mm")
      : '',
  );
  let choices: { value: string; label: string }[] = [],
    dateError = '';
  try {
    choices = scheduleOptions(local, m.timezone);
  } catch (e) {
    dateError = (e as Error).message;
  }
  return (
    <details>
      <summary>Horario, cancha y anotador</summary>
      <div className="cup-split">
        <section>
          {['scheduled', 'suspended'].includes(m.status) && (
            <ActionForm
              submit="Guardar horario"
              action={(d) => {
                if (dateError) throw Error(dateError);
                return execute(
                  `matches/${m.id}/schedule`,
                  {
                    expectedVersion: m.version,
                    fieldId: text(d, 'fieldId') || null,
                    scheduledAt:
                      choices.length > 1
                        ? text(d, 'scheduledAt')
                        : (choices[0]?.value ?? null),
                  },
                  'PATCH',
                );
              }}
              onSuccess={refresh}
            >
              <label>
                Fecha y hora · {m.timezone}
                <input
                  type="datetime-local"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                />
              </label>
              {dateError && <p role="alert">{dateError}</p>}
              {choices.length > 1 && (
                <label>
                  Esta hora ocurre dos veces. Selecciona cuál:
                  <select
                    name="scheduledAt"
                    key={local}
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Selecciona el horario
                    </option>
                    {choices.map((c) => (
                      <option value={c.value} key={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Cancha
                <select name="fieldId" defaultValue={m.fieldId ?? ''}>
                  <option value="">Sin cancha asignada</option>
                  {fields.data
                    .filter((f) => !f.archived && !f.venueArchived)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.venue} · {f.name}
                      </option>
                    ))}
                </select>
              </label>
              <CollectionFooter list={fields} />
            </ActionForm>
          )}
        </section>
        <section>
          <ActionForm
            submit="Asignar anotador"
            action={(d) =>
              execute(`matches/${m.id}/assignment`, {
                expectedVersion: m.version,
                scorerId: text(d, 'scorerId') || null,
              })
            }
            onSuccess={refresh}
          >
            <label>
              Anotador
              <select name="scorerId" defaultValue={m.scorerId ?? ''}>
                <option value="">Sin anotador</option>
                {users.data
                  .filter((u) => u.role === 'scorer' && u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </label>
            <CollectionFooter list={users} />
          </ActionForm>
        </section>
      </div>
    </details>
  );
}
