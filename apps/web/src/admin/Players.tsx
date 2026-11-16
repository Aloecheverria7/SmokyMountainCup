import { request } from './api';
import {
  ActionButton,
  ActionForm,
  CollectionFooter,
  TextField,
  text,
  useCollection,
} from './components';
import { useCompetition, useResource } from './sports';
import type { Entry } from './types';
import { useState } from 'react';
interface Player {
  id: string;
  name: string;
  birthDate: string | null;
  contact: string | null;
  archived: boolean;
  version: number;
}
export function Players({
  revision,
  refresh,
}: {
  revision: number;
  refresh: () => void;
}) {
  const players = useCollection<Player>('players', revision);
  return (
    <>
      <h1>Jugadores y plantillas</h1>
      <p className="cup-muted">
        Las fechas de nacimiento y los contactos son privados. La elegibilidad
        por edad se configurará cuando se confirme el reglamento.
      </p>
      <div className="cup-split">
        <section className="cup-panel">
          <h2>Crear jugador</h2>
          <PlayerForm
            action={(d) => request('players', 'POST', d)}
            refresh={refresh}
          />
        </section>
        <section className="cup-panel">
          <h2>Jugadores registrados</h2>
          {players.data.map((p) => (
            <article className="smc-record" key={p.id}>
              <h3>
                {p.name}
                {p.archived ? ' · Archivado' : ''}
              </h3>
              <p className="cup-muted">
                {p.birthDate || 'Nacimiento sin registrar'} ·{' '}
                {p.contact || 'Sin contacto'}
              </p>
              {!p.archived && (
                <>
                  <details>
                    <summary>Editar {p.name}</summary>
                    <PlayerForm
                      key={p.version}
                      player={p}
                      action={(d) =>
                        request(`players/${p.id}`, 'PATCH', {
                          ...d,
                          expectedVersion: p.version,
                        })
                      }
                      refresh={refresh}
                    />
                  </details>
                  <ActionButton
                    action={() =>
                      request(`players/${p.id}/archive`, 'POST', {
                        expectedVersion: p.version,
                      })
                    }
                    onSuccess={refresh}
                    confirm={`¿Archivar a ${p.name}? Se conservará su historial.`}
                  >
                    Archivar jugador
                  </ActionButton>
                </>
              )}
            </article>
          ))}
          <CollectionFooter list={players} />
        </section>
      </div>
      <section className="cup-panel">
        <h2>Plantillas por competición</h2>
        <Rosters revision={revision} refresh={refresh} />
      </section>
    </>
  );
}
function PlayerForm({
  player,
  action,
  refresh,
}: {
  player?: Player;
  action: (d: any) => Promise<any>;
  refresh: () => void;
}) {
  return (
    <ActionForm
      action={(d) =>
        action({
          name: text(d, 'name'),
          birthDate: text(d, 'birthDate') || null,
          contact: text(d, 'contact') || null,
        })
      }
      onSuccess={refresh}
      reset={!player}
    >
      <TextField
        label="Nombre del jugador"
        name="name"
        initial={player?.name}
      />
      <TextField
        label="Fecha de nacimiento (opcional)"
        name="birthDate"
        type="date"
        initial={player?.birthDate ?? ''}
        required={false}
      />
      <TextField
        label="Contacto privado (opcional)"
        name="contact"
        initial={player?.contact ?? ''}
        required={false}
        maxLength={160}
      />
    </ActionForm>
  );
}
function Rosters({
  revision,
  refresh,
}: {
  revision: number;
  refresh: () => void;
}) {
  const { competition, selector } = useCompetition(revision);
  return (
    <>
      {selector}
      {competition && (
        <EntryRoster
          key={competition.id}
          competitionId={competition.id}
          archived={competition.archived}
          revision={revision}
          refresh={refresh}
        />
      )}
    </>
  );
}
function EntryRoster({
  competitionId,
  archived,
  revision,
  refresh,
}: {
  competitionId: string;
  archived: boolean;
  revision: number;
  refresh: () => void;
}) {
  const entries = useCollection<Entry>(
      `competitions/${competitionId}/entries`,
      revision,
    ),
    players = useCollection<Player>('players', revision);
  const [eid, setEid] = useState('');
  const entry = entries.data.find((e) => e.id === eid) ?? entries.data[0];
  const roster = useResource<{
    data: {
      id: string;
      name: string;
      number: number;
      version: number;
      archived: boolean;
    }[];
  }>(entry ? `entries/${entry.id}/roster` : null, revision);
  return (
    <>
      <label>
        Equipo inscrito
        <select
          value={entry?.id ?? ''}
          onChange={(e) => setEid(e.target.value)}
        >
          <option value="" disabled>
            Selecciona un equipo
          </option>
          {entries.data.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.teamId.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <CollectionFooter list={entries} />
      {entry && !archived && (
        <ActionForm
          action={(data) =>
            request(`entries/${entry.id}/roster`, 'POST', {
              playerId: text(data, 'playerId'),
              number: Number(data.get('number')),
            })
          }
          onSuccess={refresh}
          submit="Añadir a plantilla"
        >
          <label>
            Jugador
            <select name="playerId" required defaultValue="">
              <option value="" disabled>
                Selecciona un jugador
              </option>
              {players.data
                .filter((p) => !p.archived)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.id.slice(0, 8)}
                  </option>
                ))}
            </select>
          </label>
          <CollectionFooter list={players} />
          <label>
            Dorsal
            <input name="number" type="number" min={0} max={999} required />
          </label>
        </ActionForm>
      )}
      {roster.error && <p role="alert">{roster.error}</p>}
      {roster.data?.data.map((p) => (
        <article key={p.id} className="smc-record">
          <strong>
            #{p.number} {p.name}
            {p.archived ? ' · Archivado' : ''}
          </strong>
          {!archived && (
            <details>
              <summary>Cambiar dorsal de {p.name}</summary>
              <ActionForm
                action={(data) =>
                  request(`rosters/${p.id}`, 'PATCH', {
                    expectedVersion: p.version,
                    number: Number(data.get('number')),
                  })
                }
                onSuccess={refresh}
              >
                <label>
                  Dorsal
                  <input
                    type="number"
                    name="number"
                    min={0}
                    max={999}
                    defaultValue={p.number}
                    required
                  />
                </label>
              </ActionForm>
            </details>
          )}
        </article>
      ))}
    </>
  );
}
