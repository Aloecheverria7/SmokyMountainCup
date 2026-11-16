import { useEffect, useState } from 'react';
import { request } from './api';
import {
  ActionButton,
  ActionForm,
  CollectionFooter,
  TextField,
  text,
  useCollection,
} from './components';
import type { Competition, Entry, Season, Team } from './types';
export function Seasons({
  revision,
  refresh,
}: {
  revision: number;
  refresh: () => void;
}) {
  const list = useCollection<Season>('seasons', revision);
  const [selected, setSelected] = useState('');
  const season = list.data.find((s) => s.id === selected);
  return (
    <>
      <h1>Temporadas</h1>
      <div className="cup-split">
        <section className="cup-panel">
          <h2>Nueva temporada</h2>
          <p className="cup-muted">
            Se crearán Infantil, Junior, Adulto y Femenino con grupos A y B. No
            se activará ni se importarán equipos automáticamente.
          </p>
          <ActionForm
            reset
            action={(data) =>
              request('seasons', 'POST', {
                name: text(data, 'name'),
                timezone: text(data, 'timezone'),
              })
            }
            onSuccess={refresh}
            submit="Crear temporada"
          >
            <TextField label="Nombre" name="name" />
            <TextField
              label="Zona horaria"
              name="timezone"
              initial="America/New_York"
              maxLength={80}
            />
          </ActionForm>
        </section>
        <section className="cup-panel">
          <h2>Temporadas registradas</h2>
          {!list.loading && !list.data.length && (
            <p>No hay temporadas registradas.</p>
          )}
          <div className="cup-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Temporada</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <small className="smc-block">{s.timezone}</small>
                    </td>
                    <td>
                      {s.archived
                        ? 'Archivada'
                        : s.active
                          ? 'Activa'
                          : 'Preparación'}
                    </td>
                    <td>
                      <button
                        className="cup-secondary"
                        onClick={() => setSelected(s.id)}
                      >
                        Configurar {s.name}
                      </button>
                      {!s.archived && !s.active && (
                        <ActionButton
                          action={() =>
                            request(`seasons/${s.id}/activate`, 'POST', {
                              expectedVersion: s.version,
                            })
                          }
                          onSuccess={refresh}
                        >
                          Activar
                        </ActionButton>
                      )}
                      {!s.archived && (
                        <ActionButton
                          action={() =>
                            request(`seasons/${s.id}/archive`, 'POST', {
                              expectedVersion: s.version,
                            })
                          }
                          onSuccess={refresh}
                          confirm={`¿Archivar ${s.name}? Quedará en modo de solo lectura.`}
                        >
                          Archivar
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CollectionFooter list={list} />
        </section>
      </div>
      {season && (
        <section className="cup-panel">
          <h2>{season.name}</h2>
          {!season.archived && (
            <details>
              <summary>Editar temporada</summary>
              <ActionForm
                key={season.version}
                action={(data) =>
                  request(`seasons/${season.id}`, 'PATCH', {
                    expectedVersion: season.version,
                    name: text(data, 'name'),
                    timezone: text(data, 'timezone'),
                  })
                }
                onSuccess={refresh}
              >
                <TextField label="Nombre" name="name" initial={season.name} />
                <TextField
                  label="Zona horaria"
                  name="timezone"
                  initial={season.timezone}
                  maxLength={80}
                />
              </ActionForm>
            </details>
          )}
          <Competitions
            key={season.id}
            season={season}
            revision={revision}
            refresh={refresh}
          />
        </section>
      )}
    </>
  );
}
function Competitions({
  season,
  revision,
  refresh,
}: {
  season: Season;
  revision: number;
  refresh: () => void;
}) {
  const [items, setItems] = useState<Competition[]>([]),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    request<{ data: Competition[] }>(`seasons/${season.id}/competitions`)
      .then((r) => {
        if (!disposed) {
          setItems(r.data);
          setError('');
        }
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
    };
  }, [season.id, revision]);
  const c = items.find((i) => i.id === selected);
  return (
    <>
      <h3>Competiciones independientes</h3>
      {error && <p role="alert">{error}</p>}
      <nav className="cup-tabs" aria-label="Competiciones">
        {items.map((c) => (
          <button
            key={c.id}
            className={selected === c.id ? 'active' : ''}
            onClick={() => setSelected(c.id)}
          >
            {c.name} · {c.groups.map((g) => g.name).join(' / ')}
          </button>
        ))}
      </nav>
      {c && (
        <>
          <h3>{c.name} — grupos A y B</h3>
          <p className="cup-muted">
            {c.rulesConfirmed
              ? 'Reglas confirmadas por la organización.'
              : 'Valores iniciales de configuración; el reglamento todavía no está confirmado.'}{' '}
            Los equipos inscritos se asignarán a grupos al publicar el sorteo.
          </p>
          {!season.archived && (
            <Rules
              key={c.id + ':' + c.version}
              competition={c}
              refresh={refresh}
            />
          )}
          <Entries
            key={c.id}
            competition={c}
            revision={revision}
            refresh={refresh}
          />
        </>
      )}
    </>
  );
}
function Rules({
  competition: c,
  refresh,
}: {
  competition: Competition;
  refresh: () => void;
}) {
  return (
    <details>
      <summary>Configurar reglas de {c.name}</summary>
      <ActionForm
        action={(data) =>
          request(`competitions/${c.id}`, 'PATCH', {
            expectedVersion: c.version,
            duration: Number(data.get('duration')),
            winPoints: Number(data.get('winPoints')),
            drawPoints: Number(data.get('drawPoints')),
            lossPoints: Number(data.get('lossPoints')),
            groupCapacity: Number(data.get('groupCapacity')),
            qualifiers: Number(data.get('qualifiers')),
            rulesConfirmed: data.get('rulesConfirmed') === 'on',
          })
        }
        onSuccess={refresh}
      >
        <div className="smc-fields">
          {(
            [
              ['duration', 'Duración (minutos)', c.duration, 10, 180],
              ['winPoints', 'Puntos por victoria', c.winPoints, 0, 20],
              ['drawPoints', 'Puntos por empate', c.drawPoints, 0, 20],
              ['lossPoints', 'Puntos por derrota', c.lossPoints, 0, 20],
              ['groupCapacity', 'Capacidad por grupo', c.groupCapacity, 2, 32],
              ['qualifiers', 'Clasificados por grupo', c.qualifiers, 1, 16],
            ] as const
          ).map(([name, label, value, min, max]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type="number"
                defaultValue={value}
                min={min}
                max={max}
                required
              />
            </label>
          ))}
        </div>
        <label>
          <input
            type="checkbox"
            name="rulesConfirmed"
            defaultChecked={c.rulesConfirmed}
          />{' '}
          Confirmo que estos valores corresponden al reglamento
        </label>
      </ActionForm>
    </details>
  );
}
function Entries({
  competition: c,
  revision,
  refresh,
}: {
  competition: Competition;
  revision: number;
  refresh: () => void;
}) {
  const entries = useCollection<Entry>(
      `competitions/${c.id}/entries`,
      revision,
    ),
    teams = useCollection<Team>('teams', revision);
  return (
    <>
      <h3>Equipos inscritos en {c.name}</h3>
      {!c.archived && (
        <ActionForm
          action={(data) =>
            request(`competitions/${c.id}/entries`, 'POST', {
              teamId: text(data, 'teamId'),
            })
          }
          onSuccess={refresh}
          submit="Inscribir equipo"
        >
          <label>
            Equipo
            <select name="teamId" required defaultValue="">
              <option value="" disabled>
                Selecciona un equipo
              </option>
              {teams.data
                .filter((t) => !t.archived)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.id.slice(0, 8)}
                  </option>
                ))}
            </select>
          </label>
          <CollectionFooter list={teams} />
        </ActionForm>
      )}
      <ul>
        {entries.data.map((e) => (
          <li key={e.id}>
            {e.name} <small>({e.teamId.slice(0, 8)})</small>
          </li>
        ))}
      </ul>
      {!entries.loading && !entries.data.length && (
        <p>No hay equipos inscritos.</p>
      )}
      <CollectionFooter list={entries} />
    </>
  );
}
