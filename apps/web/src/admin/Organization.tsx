import { StandingsTable } from '../StandingsTable';
import { useState } from 'react';
import { request } from './api';
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
import type { Entry, StaffUser } from './types';
export function Organization({
  revision,
  refresh,
  user,
}: {
  revision: number;
  refresh: () => void;
  user: StaffUser;
}) {
  const { competition, selector } = useCompetition(revision);
  return (
    <>
      <h1>Organización del torneo</h1>
      {selector}
      {competition && (
        <Draw
          key={competition.id}
          id={competition.id}
          name={competition.name}
          revision={revision}
          refresh={refresh}
          user={user}
        />
      )}
    </>
  );
}
function Draw({
  id,
  name,
  revision,
  refresh,
  user,
}: {
  id: string;
  name: string;
  revision: number;
  refresh: () => void;
  user: StaffUser;
}) {
  const entries = useCollection<Entry>(`competitions/${id}/entries`, revision);
  const state = useResource<{
    data: {
      id: string;
      version: number;
      published: boolean;
      imported: boolean;
      archived: boolean;
      rulesConfirmed: boolean;
      qualifiers: number;
    };
    standings: any[];
    provisional: any[];
  }>(`competitions/${id}/sport-state`, revision);
  const [preview, setPreview] = useState<any>(null);
  const operation = useOperation(user.id + ':competition:' + id);
  const c = state.data?.data;
  return (
    <section className="cup-panel">
      <h2>{name} · A / B</h2>
      <PendingNotice operation={operation} refresh={refresh} />
      {state.error && <p role="alert">{state.error}</p>}
      {c && (
        <>
          <p>
            {c.imported
              ? c.published
                ? 'Datos importados publicados.'
                : 'Datos importados sin publicar.'
              : c.published
                ? 'Sorteo publicado.'
                : 'Sorteo sin publicar.'}{' '}
            {!c.rulesConfirmed &&
              'Confirma primero las reglas desde Temporadas.'}
          </p>
          {c.imported && !c.archived && (
            <ActionForm
              submit={
                c.published
                  ? 'Ocultar datos importados'
                  : 'Publicar datos importados'
              }
              action={(d) =>
                operation.execute(`competitions/${id}/imported-publication`, {
                  expectedVersion: c.version,
                  published: !c.published,
                  reason: text(d, 'reason'),
                })
              }
              onSuccess={refresh}
            >
              <p>
                Se conservan los grupos, partidos y estadísticas iniciales.
                Publicar no genera encuentros nuevos.
              </p>
              <label>
                Motivo
                <input name="reason" maxLength={255} required />
              </label>
            </ActionForm>
          )}
          {!c.archived && !c.imported && (
            <>
              <details open={!c.published}>
                <summary>Preparar sorteo</summary>
                <p className="cup-muted">
                  El orden manual alterna un equipo en A y otro en B. Cada
                  equipo debe aparecer una vez. La vista previa caduca en 30
                  minutos.
                </p>
                <ActionForm
                  submit="Generar vista previa"
                  action={async (d) => {
                    const mode = text(d, 'mode');
                    const ordered = entries.data.map((_, i) =>
                      text(d, 'position' + i),
                    );
                    const r = await request(
                      `competitions/${id}/draw-previews`,
                      'POST',
                      {
                        mode,
                        ...(mode === 'manual' ? { entryIds: ordered } : {}),
                      },
                    );
                    setPreview(r.data);
                  }}
                >
                  <label>
                    Distribución
                    <select name="mode" defaultValue="random">
                      <option value="random">Aleatoria</option>
                      <option value="manual">Orden manual</option>
                    </select>
                  </label>
                  <details>
                    <summary>Orden manual de equipos</summary>
                    {entries.data.map((e, i) => (
                      <label key={e.id}>
                        Posición {i + 1} · grupo {i % 2 === 0 ? 'A' : 'B'}
                        <select name={'position' + i} defaultValue={e.id}>
                          {entries.data.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} · {t.teamId.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </details>
                  <CollectionFooter list={entries} />
                </ActionForm>
                {preview && (
                  <div className="smc-record">
                    <h3>Vista previa</h3>
                    {preview.groups.map((g: any) => (
                      <section key={g.name}>
                        <strong>Grupo {g.name}</strong>
                        <ol>
                          {g.entries.map((e: any) => (
                            <li key={e.id}>{e.name}</li>
                          ))}
                        </ol>
                      </section>
                    ))}
                    <ActionForm
                      submit="Publicar este sorteo"
                      action={() =>
                        operation.execute(`competitions/${id}/draw`, {
                          previewId: preview.id,
                        })
                      }
                      onSuccess={() => {
                        setPreview(null);
                        refresh();
                      }}
                    >
                      <p>
                        Publicar genera los partidos de grupos y hace visible la
                        competición.
                      </p>
                    </ActionForm>
                  </div>
                )}
              </details>
              {c.published && (
                <details>
                  <summary>Retirar sorteo no iniciado</summary>
                  <ActionForm
                    submit="Retirar sorteo"
                    action={(d) =>
                      operation.execute(`competitions/${id}/reset-draw`, {
                        expectedVersion: c.version,
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
                      Primero deben retirarse los horarios. No se permite
                      retirar un sorteo con partidos iniciados.
                    </p>
                  </ActionForm>
                </details>
              )}
            </>
          )}
          {c.published && (
            <>
              <h2>Clasificación oficial</h2>
              <StandingsTable rows={state.data!.standings} />
              {!c.archived && (
                <>
                  <details>
                    <summary>Confirmar clasificados y cruces</summary>
                    <p className="cup-muted">
                      Se requieren todos los resultados de grupos confirmados.
                      El orden elegido define los cruces consecutivos.
                    </p>
                    <ActionForm
                      submit="Crear eliminatorias"
                      action={(d) =>
                        operation.execute(`competitions/${id}/qualify`, {
                          expectedVersion: c.version,
                          entryIds: Array.from(
                            { length: 2 * c.qualifiers },
                            (_, i) => text(d, 'seed' + i),
                          ),
                          ...(text(d, 'tieReason')
                            ? { tieReason: text(d, 'tieReason') }
                            : {}),
                        })
                      }
                      onSuccess={refresh}
                    >
                      {Array.from({ length: 2 * c.qualifiers }, (_, i) => (
                        <label key={i}>
                          Plaza {i + 1} · cruce {Math.floor(i / 2) + 1}
                          <select name={'seed' + i} required defaultValue="">
                            <option value="" disabled>
                              Selecciona un clasificado
                            </option>
                            {state.data!.standings.map((e) => (
                              <option key={e.id} value={e.id}>
                                Grupo {e.group_name} · {e.name} · {e.points} pts
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                      <label>
                        Motivo de desempate exacto (si corresponde)
                        <textarea name="tieReason" maxLength={255} />
                      </label>
                    </ActionForm>
                  </details>
                  <details>
                    <summary>Corregir rondas posteriores</summary>
                    <ActionForm
                      submit="Retirar rondas no iniciadas"
                      action={(d) =>
                        operation.execute(`competitions/${id}/remove-rounds`, {
                          expectedVersion: c.version,
                          fromRound: Number(d.get('fromRound')),
                          reason: text(d, 'reason'),
                        })
                      }
                      onSuccess={refresh}
                    >
                      <label>
                        Desde la ronda
                        <input
                          name="fromRound"
                          type="number"
                          min={1}
                          max={10}
                          required
                        />
                      </label>
                      <label>
                        Motivo
                        <input name="reason" maxLength={255} required />
                      </label>
                    </ActionForm>
                    <ActionForm
                      submit="Reconstruir rondas posteriores"
                      action={(d) =>
                        operation.execute(`competitions/${id}/rebuild-rounds`, {
                          expectedVersion: c.version,
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
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
